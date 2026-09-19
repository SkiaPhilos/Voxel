import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, Clock, X, Check, ArrowRight } from 'lucide-react';
import type { Lead } from '../types';
import { toDatetimeLocal, fromDatetimeLocal } from '../lib/dateUtils';

interface QuickPostponeModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onPostpone: (leadId: string, newDatetimeIso: string) => Promise<void> | void;
}

export const QuickPostponeModal: React.FC<QuickPostponeModalProps> = ({
  lead,
  isOpen,
  onClose,
  onPostpone,
}) => {
  const [customDate, setCustomDate] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !lead) return null;

  const now = new Date();

  // Helper to compute target dates
  const getPostponeOption = (daysToAdd: number, hours: number = 10) => {
    const d = new Date(now);
    d.setDate(d.getDate() + daysToAdd);
    d.setHours(hours, 0, 0, 0);
    return d.toISOString();
  };

  const getNextMondayOption = () => {
    const d = new Date(now);
    const day = d.getDay(); // 0 is Sunday, 1 is Monday
    const daysUntilMonday = day === 0 ? 1 : 8 - day;
    d.setDate(d.getDate() + daysUntilMonday);
    d.setHours(10, 0, 0, 0);
    return d.toISOString();
  };

  const options = [
    {
      label: 'Tomorrow Morning',
      sublabel: '+1 day at 10:00 AM',
      iso: getPostponeOption(1, 10),
      badge: 'Most Popular',
    },
    {
      label: 'In 2 Days',
      sublabel: '+2 days at 10:00 AM',
      iso: getPostponeOption(2, 10),
    },
    {
      label: 'In 3 Days',
      sublabel: '+3 days at 10:00 AM',
      iso: getPostponeOption(3, 10),
    },
    {
      label: 'Next Monday',
      sublabel: 'Kickoff next week',
      iso: getNextMondayOption(),
    },
  ];

  const handleSelectIso = async (iso: string) => {
    setIsSubmitting(true);
    try {
      await onPostpone(lead.id, iso);
      onClose();
    } catch (err) {
      console.error('Failed to postpone lead', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customDate) return;
    const iso = fromDatetimeLocal(customDate);
    if (!iso) return;
    await handleSelectIso(iso);
  };

  return typeof document !== 'undefined'
    ? createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#FAF8F5] border border-stone-200 rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-xs">
              <Calendar className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900">Postpone &amp; Reschedule</h3>
              <p className="text-xs text-stone-500">Move follow-up for <span className="font-semibold text-stone-700">{lead.name}</span></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-4">
          <div className="text-xs font-semibold text-stone-600 uppercase tracking-wider">
            Quick 1-Tap Reschedule
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {options.map((opt, idx) => (
              <button
                key={idx}
                type="button"
                disabled={isSubmitting}
                onClick={() => handleSelectIso(opt.iso)}
                className="relative text-left p-3 rounded-xl bg-white hover:bg-sky-50/60 border border-stone-200 hover:border-sky-300 transition-all shadow-2xs group cursor-pointer disabled:opacity-50"
              >
                {opt.badge && (
                  <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-800">
                    {opt.badge}
                  </span>
                )}
                <div className="text-xs font-bold text-stone-900 group-hover:text-sky-900 flex items-center gap-1.5">
                  <span>{opt.label}</span>
                  <ArrowRight className="w-3 h-3 text-stone-300 group-hover:text-sky-600 group-hover:translate-x-0.5 transition-all" />
                </div>
                <div className="text-[11px] text-stone-500 group-hover:text-sky-700 mt-0.5">
                  {opt.sublabel}
                </div>
              </button>
            ))}
          </div>

          {/* Custom Date Picker */}
          <div className="pt-2 border-t border-stone-200">
            <form onSubmit={handleCustomSubmit} className="space-y-2">
              <label className="block text-xs font-semibold text-stone-700 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-stone-500" />
                <span>Or Select Exact Date &amp; Time</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="datetime-local"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="flex-1 px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-sky-600 shadow-2xs"
                />
                <button
                  type="submit"
                  disabled={!customDate || isSubmitting}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 shrink-0"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>,
    document.body
  ) : null;
};
