import React, { useState, useEffect } from 'react';
import {
  Clock,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Calendar,
  Layers,
} from 'lucide-react';
import type { OutcomeCadenceConfig, OutcomeCadenceRule, OutcomeTag, Priority, CadenceIntervalUnit } from '../types';
import { api } from '../lib/api';

const ALL_OUTCOMES: Array<{
  tag: OutcomeTag;
  label: string;
  badgeClass: string;
  defaultDescription: string;
}> = [
  {
    tag: 'Interested',
    label: 'Interested',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    defaultDescription: 'Lead showed strong product interest or requested a proposal.',
  },
  {
    tag: 'Call Back Later',
    label: 'Call Back Later',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    defaultDescription: 'Lead asked for a reschedule or wasn’t available to talk right now.',
  },
  {
    tag: 'Busy',
    label: 'Busy',
    badgeClass: 'bg-orange-50 text-orange-800 border-orange-200',
    defaultDescription: 'Line was busy or lead hung up saying they are occupied.',
  },
  {
    tag: "Couldn't Connect",
    label: "Couldn't Connect",
    badgeClass: 'bg-stone-100 text-stone-700 border-stone-300',
    defaultDescription: 'No answer, voicemail, or disconnected circuit.',
  },
  {
    tag: 'Closed/Matured',
    label: 'Closed / Matured',
    badgeClass: 'bg-teal-50 text-teal-800 border-teal-200',
    defaultDescription: 'Deal successfully won. Auto-archive prevents unneeded dials.',
  },
  {
    tag: 'Service Denied',
    label: 'Service Denied',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
    defaultDescription: 'Lead explicitly rejected the offer or requested removal.',
  },
  {
    tag: 'Other',
    label: 'Other',
    badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    defaultDescription: 'Miscellaneous or ad-hoc custom touchpoint.',
  },
];

export const CadenceSettings: React.FC = () => {
  const [cadence, setCadence] = useState<OutcomeCadenceConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadCadence();
  }, []);

  const loadCadence = async () => {
    setIsLoading(true);
    try {
      const res = await api.getCadenceConfig();
      if (res.cadence) {
        setCadence(res.cadence);
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to load cadence settings' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRuleChange = (
    outcome: OutcomeTag,
    field: keyof OutcomeCadenceRule,
    value: any
  ) => {
    if (!cadence) return;
    setCadence((prev) => {
      if (!prev) return prev;
      const currentRule = prev[outcome] || {
        outcome,
        delayValue: 24,
        delayUnit: 'hours',
        defaultPriority: 'Normal',
        autoArchive: false,
      };
      return {
        ...prev,
        [outcome]: {
          ...currentRule,
          [field]: value,
        },
      };
    });
  };

  const handleSave = async () => {
    if (!cadence) return;
    setIsSaving(true);
    setStatusMessage(null);
    try {
      const res = await api.updateCadenceConfig(cadence);
      setCadence(res.cadence);
      setStatusMessage({ type: 'success', text: 'Cadence rules successfully saved!' });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to update cadence rules' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset all outcome cadences back to default intervals?')) return;
    setIsSaving(true);
    setStatusMessage(null);
    try {
      const res = await api.resetCadenceConfig();
      setCadence(res.cadence);
      setStatusMessage({ type: 'success', text: 'Cadences reset to factory presets' });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to reset cadences' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !cadence) {
    return (
      <div className="p-8 text-center text-stone-500 flex flex-col items-center justify-center gap-2">
        <Clock className="w-6 h-6 animate-spin text-amber-700" />
        <p className="text-sm font-medium">Loading cadence configurations...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Description */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-700" />
            <h3 className="text-base font-bold text-stone-900">Customizable Quick-Outcome Cadences</h3>
          </div>
          <p className="text-xs text-stone-500 mt-1 max-w-2xl">
            Configure default follow-up intervals, automated scheduling hours, and default priority per outcome.
            When an agent logs an outcome, the next touchpoint date is computed automatically to maximize calling velocity.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleReset}
            disabled={isSaving}
            className="px-3 py-2 text-xs font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Reset to factory cadences"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 text-xs font-bold text-white bg-amber-700 hover:bg-amber-800 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save Cadences'}</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center gap-2 animate-in fade-in ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Cadence Rules Grid */}
      <div className="space-y-3">
        {ALL_OUTCOMES.map((item) => {
          const rule: OutcomeCadenceRule = cadence[item.tag] || {
            outcome: item.tag,
            delayValue: item.tag === 'Closed/Matured' || item.tag === 'Service Denied' ? 0 : 24,
            delayUnit: 'hours',
            defaultPriority: 'Normal',
            autoArchive: item.tag === 'Closed/Matured' || item.tag === 'Service Denied',
            notesSnippet: '',
          };

          const isArchive = rule.autoArchive || rule.delayValue === 0;

          return (
            <div
              key={item.tag}
              className="p-4 bg-white border border-stone-200 rounded-xl shadow-2xs hover:border-stone-300 transition-all"
            >
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                {/* Outcome Badge & Desc */}
                <div className="md:col-span-4 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border ${item.badgeClass}`}>
                      {item.label}
                    </span>
                    {isArchive && (
                      <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-stone-100 text-stone-500">
                        Archive / Terminate
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-500">{item.defaultDescription}</p>
                </div>

                {/* Follow-up Timing Controls */}
                <div className="md:col-span-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-stone-700 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-stone-400" />
                      Follow-up Interval:
                    </label>
                    <label className="text-[11px] text-stone-500 flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rule.autoArchive || false}
                        onChange={(e) => handleRuleChange(item.tag, 'autoArchive', e.target.checked)}
                        className="rounded text-amber-700 focus:ring-amber-700"
                      />
                      <span>No follow-up</span>
                    </label>
                  </div>

                  {!rule.autoArchive && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="1"
                          max="365"
                          value={rule.delayValue}
                          onChange={(e) =>
                            handleRuleChange(item.tag, 'delayValue', Math.max(1, parseInt(e.target.value) || 1))
                          }
                          className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-300 rounded-lg text-xs font-bold text-stone-800 text-center focus:bg-white focus:ring-2 focus:ring-amber-700"
                        />
                        <span className="text-xs text-stone-400 font-bold">Qty</span>
                      </div>
                      <select
                        value={rule.delayUnit}
                        onChange={(e) =>
                          handleRuleChange(item.tag, 'delayUnit', e.target.value as CadenceIntervalUnit)
                        }
                        className="w-full px-2 py-1.5 bg-stone-50 border border-stone-300 rounded-lg text-xs font-medium text-stone-800 focus:bg-white focus:ring-2 focus:ring-amber-700 cursor-pointer"
                      >
                        <option value="hours">Hours</option>
                        <option value="days">Days</option>
                      </select>
                    </div>
                  )}

                  {!rule.autoArchive && rule.delayUnit === 'days' && (
                    <div className="flex items-center justify-between text-[11px] text-stone-500 pt-1">
                      <span>Preferred Hour:</span>
                      <select
                        value={rule.preferredHour ?? 10}
                        onChange={(e) =>
                          handleRuleChange(item.tag, 'preferredHour', parseInt(e.target.value))
                        }
                        className="px-1.5 py-0.5 bg-stone-50 border border-stone-200 rounded text-xs text-stone-700"
                      >
                        <option value={9}>9:00 AM</option>
                        <option value={10}>10:00 AM</option>
                        <option value={11}>11:00 AM</option>
                        <option value={14}>2:00 PM</option>
                        <option value={16}>4:00 PM</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Priority & Quick Note Snippet */}
                <div className="md:col-span-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-stone-700">Default Priority:</label>
                    <select
                      value={rule.defaultPriority || 'Normal'}
                      onChange={(e) =>
                        handleRuleChange(item.tag, 'defaultPriority', e.target.value as Priority)
                      }
                      className="px-2 py-1 bg-stone-50 border border-stone-300 rounded-lg text-xs font-semibold text-stone-800 focus:bg-white focus:ring-2 focus:ring-amber-700 cursor-pointer"
                    >
                      <option value="Low">Low</option>
                      <option value="Normal">Normal</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent 🔥</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] text-stone-500 block mb-1">
                      Default Quick-Log Summary:
                    </label>
                    <input
                      type="text"
                      value={rule.notesSnippet || ''}
                      onChange={(e) => handleRuleChange(item.tag, 'notesSnippet', e.target.value)}
                      placeholder="Default call note text..."
                      className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-300 rounded-lg text-xs text-stone-800 placeholder-stone-400 focus:bg-white focus:ring-2 focus:ring-amber-700"
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
