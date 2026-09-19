import React, { useState } from 'react';
import { AlertCircle, Phone, ChevronDown, ChevronUp, CalendarClock, PhoneCall } from 'lucide-react';
import type { Lead } from '../types';
import { getDaysSinceLastTouch } from '../lib/dateUtils';
import { ContactActionMenu } from './ContactActionMenu';

interface StaleLeadsSectionProps {
  leads: Lead[];
  onLogCall: (lead: Lead) => void;
  onOpenDetail: (lead: Lead) => void;
  onStartPowerDialer?: (leads: Lead[]) => void;
}

export const StaleLeadsSection: React.FC<StaleLeadsSectionProps> = ({
  leads,
  onLogCall,
  onOpenDetail,
  onStartPowerDialer,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (leads.length === 0) return null;

  return (
    <div className="mb-6 rounded-2xl border border-stone-300/80 bg-stone-50/80 p-4 sm:p-5 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-stone-200 text-stone-700 flex items-center justify-center shrink-0">
            <CalendarClock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <span>Stale — Check Back In</span>
              <span className="px-2 py-0.5 rounded-full bg-stone-200 text-stone-800 font-bold text-xs">
                {leads.length} Cold
              </span>
            </h3>
            <p className="text-xs text-stone-500">
              Active leads with no call attempts in 5–10+ days. Needs a quick check-in.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {onStartPowerDialer && leads.length > 0 && (
            <button
              type="button"
              onClick={() => onStartPowerDialer(leads)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-900 text-white text-xs font-bold transition-all cursor-pointer shadow-2xs shrink-0"
              title="Start rapid calling through stale leads"
            >
              <PhoneCall className="w-3.5 h-3.5 text-amber-400" />
              <span>Call Stale Queue ({leads.length})</span>
            </button>
          )}

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-xs font-semibold text-stone-600 hover:text-stone-900 flex items-center gap-1 p-1.5 rounded-md hover:bg-stone-200/50 transition-colors cursor-pointer"
          >
            <span>{isCollapsed ? 'Show Leads' : 'Collapse'}</span>
            {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-3.5 pt-3 border-t border-stone-200/80">
          {leads.map((lead) => {
            const daysCold = getDaysSinceLastTouch(lead);
            return (
              <div
                key={lead.id}
                className="p-3 bg-white rounded-xl border border-stone-200 shadow-2xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <button
                      onClick={() => onOpenDetail(lead)}
                      className="font-bold text-stone-900 text-xs hover:text-amber-800 text-left truncate cursor-pointer"
                    >
                      {lead.name}
                    </button>
                    <span className="text-[10px] font-semibold text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded">
                      {daysCold} days untouched
                    </span>
                  </div>

                  <div className="mb-2">
                    <ContactActionMenu
                      contact={{
                        name: lead.name,
                        phone: lead.phone,
                        business_notes: lead.business_notes,
                        business_info: lead.business_info,
                        source: lead.source,
                      }}
                    />
                  </div>

                  {lead.business_notes && (
                    <p className="text-[11px] text-stone-500 line-clamp-1 mb-2">
                      {lead.business_notes}
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-stone-100 flex items-center justify-end gap-2">
                  <button
                    onClick={() => onOpenDetail(lead)}
                    className="text-[11px] text-stone-500 hover:text-stone-800 cursor-pointer"
                  >
                    View History
                  </button>
                  <button
                    onClick={() => onLogCall(lead)}
                    className="text-xs font-semibold bg-stone-800 hover:bg-stone-900 text-white px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Phone className="w-3 h-3" />
                    <span>Re-Dial</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
