import React, { useState, useEffect, useRef } from 'react';
import {
  PhoneCall,
  Phone,
  MessageSquare,
  Mail,
  Flame,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  Pause,
  SkipForward,
  ChevronRight,
  ShieldAlert,
  Building2,
  Calendar,
  X,
  Sparkles,
  BarChart3,
  RefreshCw,
  Undo2,
  MessageSquareText,
} from 'lucide-react';
import type { Lead, OutcomeTag, Priority, OutcomeCadenceConfig } from '../types';
import { ContactActionMenu } from './ContactActionMenu';
import { ObjectionDrawer } from './ObjectionDrawer';
import { SmartFollowUpModal } from './SmartFollowUpModal';
import { getQuickPresets, toDatetimeLocal, fromDatetimeLocal, computeCadenceFollowUpDate } from '../lib/dateUtils';
import { api } from '../lib/api';

interface PowerDialerModalProps {
  queue: Lead[];
  isOpen: boolean;
  onClose: () => void;
  onSaveCall: (
    leadId: string,
    callData: {
      outcome_tag: OutcomeTag;
      summary: string;
      full_notes: string;
      next_action_at?: string | null;
      business_info?: string;
      priority?: Priority;
    }
  ) => Promise<void>;
  queueTitle?: string;
}

const OUTCOME_OPTIONS: Array<{
  tag: OutcomeTag;
  label: string;
  badgeClass: string;
}> = [
  { tag: 'Interested', label: 'Interested', badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200' },
  { tag: 'Call Back Later', label: 'Call Back Later', badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200' },
  { tag: 'Busy', label: 'Line Busy', badgeClass: 'bg-stone-100 text-stone-700 border-stone-300 hover:bg-stone-200' },
  { tag: "Couldn't Connect", label: "Couldn't Connect", badgeClass: 'bg-stone-100 text-stone-700 border-stone-300 hover:bg-stone-200' },
  { tag: 'Closed/Matured', label: 'Closed 🎉', badgeClass: 'bg-teal-100 text-teal-900 border-teal-400 hover:bg-teal-200' },
  { tag: 'Service Denied', label: 'Denied', badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200' },
  { tag: 'Other', label: 'Other', badgeClass: 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200' },
];

export const PowerDialerModal: React.FC<PowerDialerModalProps> = ({
  queue,
  isOpen,
  onClose,
  onSaveCall,
  queueTitle = 'Calling Queue',
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [outcome, setOutcome] = useState<OutcomeTag>('Interested');
  const [summary, setSummary] = useState('');
  const [fullNotes, setFullNotes] = useState('');
  const [businessInfo, setBusinessInfo] = useState('');
  const [priority, setPriority] = useState<Priority>('Normal');
  const [nextActionAt, setNextActionAt] = useState<string | null>(null);
  const [customDatetime, setCustomDatetime] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showObjections, setShowObjections] = useState(false);

  // Auto-advance countdown timer state
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isFinished, setIsFinished] = useState(false);

  // Gemini AI Call Note Structuring & Smart Follow-Up
  const [isEnhancingWithAI, setIsEnhancingWithAI] = useState(false);
  const [rawNotesBackup, setRawNotesBackup] = useState<string | null>(null);
  const [aiSentiment, setAiSentiment] = useState<string | null>(null);
  const [isFollowUpOpen, setIsFollowUpOpen] = useState(false);

  // Session Statistics
  const [sessionStats, setSessionStats] = useState({
    completedDials: 0,
    interested: 0,
    callLater: 0,
    closed: 0,
    unreachable: 0,
  });

  const [cadenceConfig, setCadenceConfig] = useState<OutcomeCadenceConfig | null>(null);

  useEffect(() => {
    let mounted = true;
    api.getCadenceConfig()
      .then((res) => {
        if (mounted && res.cadence) {
          setCadenceConfig(res.cadence);
        }
      })
      .catch((err) => {
        console.warn('Could not fetch cadence in power dialer', err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const currentLead = queue[currentIndex] || null;

  // Initialize form when moving to a new lead
  useEffect(() => {
    if (currentLead) {
      const defaultTag: OutcomeTag = 'Interested';
      setOutcome(defaultTag);
      const rule = cadenceConfig ? cadenceConfig[defaultTag] : null;

      if (rule) {
        setSummary(rule.notesSnippet || 'Interested in product overview and pricing');
        if (rule.defaultPriority) setPriority(rule.defaultPriority);
        if (rule.autoArchive) {
          setNextActionAt(null);
          setCustomDatetime('');
        } else {
          const autoIso = computeCadenceFollowUpDate(rule);
          setNextActionAt(autoIso);
          setCustomDatetime(toDatetimeLocal(autoIso));
        }
      } else {
        setSummary('Interested in product overview and pricing');
        setPriority(currentLead.priority || 'Normal');
        setNextActionAt(currentLead.next_action_at || null);
        setCustomDatetime(toDatetimeLocal(currentLead.next_action_at));
      }

      setFullNotes('');
      setBusinessInfo(currentLead.business_info || '');
      setCountdown(null);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    }
  }, [currentIndex, currentLead?.id, cadenceConfig]);

  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  if (!isOpen || queue.length === 0) return null;

  const presets = getQuickPresets();

  const handleEnhanceWithAI = async () => {
    if (!currentLead || !fullNotes.trim()) return;
    setIsEnhancingWithAI(true);
    try {
      setRawNotesBackup(fullNotes);
      const res = await api.enhanceCallNotes({
        leadName: currentLead.name,
        businessInfo: businessInfo || currentLead.business_info || currentLead.business_notes,
        outcomeTag: outcome,
        rawNotes: fullNotes,
      });
      if (res.enhanced) {
        setFullNotes(res.enhanced.formattedNotes);
        if (!summary || summary.trim().length === 0 || summary.startsWith('Call logged')) {
          setSummary(res.enhanced.cleanSummary);
        }
        setAiSentiment(res.enhanced.sentiment);
      }
    } catch (err) {
      console.error('Failed to enhance dialer notes with AI:', err);
    } finally {
      setIsEnhancingWithAI(false);
    }
  };

  const handleRevertNotes = () => {
    if (rawNotesBackup !== null) {
      setFullNotes(rawNotesBackup);
      setRawNotesBackup(null);
      setAiSentiment(null);
    }
  };

  const handleOutcomeSelect = (tag: OutcomeTag) => {
    setOutcome(tag);

    const rule = cadenceConfig ? cadenceConfig[tag] : null;

    if (rule) {
      if (rule.notesSnippet) {
        setSummary(rule.notesSnippet);
      }
      if (rule.defaultPriority) {
        setPriority(rule.defaultPriority);
      }
      if (rule.autoArchive) {
        setNextActionAt(null);
        setCustomDatetime('');
      } else {
        const autoIso = computeCadenceFollowUpDate(rule);
        if (autoIso) {
          setNextActionAt(autoIso);
          setCustomDatetime(toDatetimeLocal(autoIso));
        }
      }
    } else {
      if (tag === 'Interested') setSummary('Prospect interested in demo and overview.');
      if (tag === 'Call Back Later') setSummary('Prospect requested follow-up call.');
      if (tag === 'Busy') setSummary('Line was busy. Re-dial required.');
      if (tag === "Couldn't Connect") setSummary('Rang through / left voicemail.');
      if (tag === 'Closed/Matured') setSummary('Deal closed and finalized!');
      if (tag === 'Service Denied') setSummary('Prospect declined service.');

      if (tag === 'Call Back Later') {
        setNextActionAt(presets[1].value);
        setCustomDatetime(toDatetimeLocal(presets[1].value));
      } else if (tag === 'Closed/Matured' || tag === 'Service Denied') {
        setNextActionAt(null);
        setCustomDatetime('');
      }
    }
  };

  const executeSave = async (advanceImmediately = false) => {
    if (!currentLead) return;
    setIsSubmitting(true);
    try {
      await onSaveCall(currentLead.id, {
        outcome_tag: outcome,
        summary: summary.trim() || `Call logged (${outcome})`,
        full_notes: fullNotes.trim(),
        next_action_at: outcome === 'Closed/Matured' || outcome === 'Service Denied' ? null : nextActionAt,
        business_info: businessInfo.trim() || undefined,
        priority,
      });

      // Update session metrics
      setSessionStats((prev) => ({
        ...prev,
        completedDials: prev.completedDials + 1,
        interested: outcome === 'Interested' ? prev.interested + 1 : prev.interested,
        callLater: outcome === 'Call Back Later' ? prev.callLater + 1 : prev.callLater,
        closed: outcome === 'Closed/Matured' ? prev.closed + 1 : prev.closed,
        unreachable: outcome === 'Busy' || outcome === "Couldn't Connect" ? prev.unreachable + 1 : prev.unreachable,
      }));

      // Check if more leads are left
      if (currentIndex + 1 < queue.length) {
        if (autoAdvanceEnabled && !advanceImmediately) {
          // Trigger 5-second countdown
          startAutoAdvanceCountdown();
        } else {
          setCurrentIndex((prev) => prev + 1);
        }
      } else {
        // Finished entire queue
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        setCountdown(null);
        setIsFinished(true);
      }
    } catch (err) {
      console.error('Failed to log call in dialer', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const startAutoAdvanceCountdown = () => {
    let timeLeft = 4;
    setCountdown(timeLeft);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = setInterval(() => {
      timeLeft -= 1;
      setCountdown(timeLeft);
      if (timeLeft <= 0) {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        setCountdown(null);
        setCurrentIndex((prev) => prev + 1);
      }
    }, 1000);
  };

  const cancelCountdown = () => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setCountdown(null);
  };

  const skipCurrentLead = () => {
    cancelCountdown();
    if (currentIndex + 1 < queue.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsFinished(true);
    }
  };

  if (isFinished) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/75 backdrop-blur-xs">
        <div className="w-full max-w-lg bg-[#FAF8F5] border border-stone-200 rounded-3xl shadow-2xl p-6 sm:p-8 text-center space-y-6 animate-in fade-in zoom-in-95">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 border border-emerald-300 text-emerald-700 flex items-center justify-center mx-auto shadow-xs">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-xs font-bold uppercase tracking-wider border border-amber-200">
              Session Complete
            </span>
            <h2 className="text-xl font-bold text-stone-900 mt-2">All Queue Calls Completed!</h2>
            <p className="text-xs sm:text-sm text-stone-600 mt-1">
              You worked through all {queue.length} leads in <span className="font-semibold text-stone-900">{queueTitle}</span>.
            </p>
          </div>

          {/* Performance Summary Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-left">
            <div className="p-3 bg-white border border-stone-200 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-stone-400">Total Dials</span>
              <div className="text-lg font-extrabold text-stone-900">{sessionStats.completedDials}</div>
            </div>
            <div className="p-3 bg-white border border-stone-200 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-emerald-600">Interested</span>
              <div className="text-lg font-extrabold text-emerald-700">{sessionStats.interested}</div>
            </div>
            <div className="p-3 bg-white border border-stone-200 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-amber-600">Call Later</span>
              <div className="text-lg font-extrabold text-amber-700">{sessionStats.callLater}</div>
            </div>
            <div className="p-3 bg-white border border-stone-200 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-teal-600">Closed</span>
              <div className="text-lg font-extrabold text-teal-700">{sessionStats.closed}</div>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              Finish & Return to Pipeline
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-stone-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-4xl my-auto bg-[#FAF8F5] border border-stone-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Top Dialer HUD Banner */}
        <div className="p-4 bg-stone-900 text-stone-100 flex flex-wrap items-center justify-between gap-3 border-b border-stone-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-600 text-amber-50 flex items-center justify-center shadow-xs">
              <PhoneCall className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold text-xs uppercase tracking-wider border border-amber-500/30">
                  Power Dialer
                </span>
                <h3 className="text-base font-bold text-white">{queueTitle}</h3>
              </div>
              <p className="text-xs text-stone-400">
                Lead {currentIndex + 1} of {queue.length} in current calling queue
              </p>
            </div>
          </div>

          {/* Session Performance Stats */}
          <div className="flex items-center gap-2 sm:gap-4 text-xs">
            <div className="flex items-center gap-1.5 bg-stone-800/80 px-3 py-1.5 rounded-xl border border-stone-700/60">
              <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-stone-300">Dials:</span>
              <span className="font-bold text-white">{sessionStats.completedDials}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-stone-800/80 px-3 py-1.5 rounded-xl border border-stone-700/60">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-stone-300">Interested:</span>
              <span className="font-bold text-emerald-400">{sessionStats.interested}</span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800 transition-colors"
              title="Close session"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Countdown Auto-Advance Banner (If active) */}
        {countdown !== null && (
          <div className="bg-amber-600 text-white px-4 py-2 flex items-center justify-between text-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 animate-spin" />
              <span className="font-bold">
                Call logged! Auto-advancing to next lead in {countdown}s...
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelCountdown}
                className="px-2.5 py-1 rounded-lg bg-stone-900/40 hover:bg-stone-900/60 text-white font-semibold cursor-pointer"
              >
                Pause Auto-Advance
              </button>
              <button
                type="button"
                onClick={() => {
                  cancelCountdown();
                  setCurrentIndex((prev) => prev + 1);
                }}
                className="px-2.5 py-1 rounded-lg bg-white text-amber-900 font-bold hover:bg-amber-50 cursor-pointer"
              >
                Next Lead Now ➔
              </button>
            </div>
          </div>
        )}

        {/* Main Content Area: Left Prospect & Logging Form | Right Objections Drawer (Toggleable) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Prospect Details & Call Form */}
          <div className={`${showObjections ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-5`}>
            {/* Prospect Card & Instant Trigger Actions */}
            <div className="p-4 bg-white border border-stone-200 rounded-2xl shadow-2xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-stone-900">{currentLead?.name}</h2>
                    {currentLead?.priority === 'High' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 flex items-center gap-1 border border-amber-200">
                        <Flame className="w-3 h-3 text-amber-600" />
                        <span>High Priority</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-500">
                    {currentLead?.phone} {currentLead?.email ? `• ${currentLead?.email}` : ''}
                  </p>
                </div>

                {/* Instant Quick Dial & Message Action Triggers */}
                {currentLead && (
                  <div className="flex items-center gap-2">
                    <a
                      href={`tel:${currentLead.phone}`}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                      title="Click to Dial"
                    >
                      <Phone className="w-4 h-4" />
                      <span>Dial Now</span>
                    </a>
                    <ContactActionMenu
                      contact={{
                        name: currentLead.name,
                        phone: currentLead.phone,
                        business_notes: currentLead.business_notes,
                        business_info: currentLead.business_info,
                        source: currentLead.source,
                      }}
                      size="sm"
                    />
                  </div>
                )}
              </div>

              {/* Lead Context / Business Notes */}
              {currentLead?.business_notes && (
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-700">
                  <span className="font-semibold text-stone-900">Lead Background: </span>
                  {currentLead.business_notes}
                </div>
              )}

              {/* Toggle Objection Helper button */}
              <div className="pt-1 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowObjections((prev) => !prev)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    showObjections
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                  }`}
                >
                  <ShieldAlert className="w-4 h-4 text-amber-700" />
                  <span>{showObjections ? 'Hide Battle Cards' : 'Open Objection Rebuttals & Scripts'}</span>
                </button>

                <div className="flex items-center gap-2 text-xs text-stone-500">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoAdvanceEnabled}
                      onChange={(e) => setAutoAdvanceEnabled(e.target.checked)}
                      className="rounded text-amber-700 focus:ring-amber-700"
                    />
                    <span>5s Auto-advance</span>
                  </label>
                  <button
                    type="button"
                    onClick={skipCurrentLead}
                    className="text-stone-500 hover:text-stone-800 underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>Skip lead</span>
                    <SkipForward className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* In-Call Outcome Logging Form */}
            <div className="p-5 bg-white border border-stone-200 rounded-2xl shadow-2xs space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                  Call Outcome
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {OUTCOME_OPTIONS.map((item) => {
                    const isSelected = outcome === item.tag;
                    const rule = cadenceConfig ? cadenceConfig[item.tag] : null;
                    const cadenceHint = rule && !rule.autoArchive && rule.delayValue > 0
                      ? `+${rule.delayValue}${rule.delayUnit === 'hours' ? 'h' : 'd'}`
                      : null;

                    return (
                      <button
                        key={item.tag}
                        type="button"
                        onClick={() => handleOutcomeSelect(item.tag)}
                        className={`p-2 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                          isSelected
                            ? 'ring-2 ring-amber-700 shadow-xs border-amber-700 font-extrabold ' + item.badgeClass
                            : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                        }`}
                      >
                        <span>{item.label}</span>
                        {cadenceHint && (
                          <span className="text-[10px] px-1 py-0 rounded bg-stone-100/90 text-stone-600 font-mono font-normal">
                            {cadenceHint}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Call Summary */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Call Summary Headline
                </label>
                <input
                  type="text"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="e.g. Connected with decision maker, demo requested"
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:ring-2 focus:ring-amber-700"
                />
              </div>

              {/* Call Notes */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-stone-700">
                    Detailed Call Notes
                  </label>

                  <div className="flex items-center gap-1.5">
                    {rawNotesBackup && (
                      <button
                        type="button"
                        onClick={handleRevertNotes}
                        className="inline-flex items-center gap-1 text-[11px] text-stone-500 hover:text-stone-800 transition-colors cursor-pointer"
                      >
                        <Undo2 className="w-3 h-3" />
                        <span>Undo</span>
                      </button>
                    )}

                    {aiSentiment && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-amber-100 text-amber-900 border border-amber-200">
                        {aiSentiment}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={handleEnhanceWithAI}
                      disabled={isEnhancingWithAI || !fullNotes.trim()}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white text-[11px] font-bold shadow-2xs transition-all disabled:opacity-40 cursor-pointer"
                      title="Structure shorthand into key takeaways & next steps"
                    >
                      <Sparkles className={`w-3 h-3 ${isEnhancingWithAI ? 'animate-spin' : ''}`} />
                      <span>{isEnhancingWithAI ? 'Structuring...' : 'AI Enhance'}</span>
                    </button>
                  </div>
                </div>

                <textarea
                  rows={3}
                  value={fullNotes}
                  onChange={(e) => setFullNotes(e.target.value)}
                  placeholder="Notes from call, pain points, competitor used, objections raised..."
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:ring-2 focus:ring-amber-700 resize-y leading-relaxed font-sans"
                />
              </div>

              {/* Follow-up Next Action */}
              {outcome !== 'Closed/Matured' && outcome !== 'Service Denied' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-amber-700" />
                      <span>Next Follow-up</span>
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

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 mb-2">
                    {presets.map((p) => {
                      const isSelected = nextActionAt === p.value;
                      return (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => {
                            setNextActionAt(p.value);
                            setCustomDatetime(toDatetimeLocal(p.value));
                          }}
                          className={`px-2 py-1 text-[11px] rounded-lg border font-semibold transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-amber-700 text-white border-amber-700'
                              : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                          }`}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Log and Advance Actions */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 border-t border-stone-100">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={skipCurrentLead}
                    disabled={isSubmitting}
                    className="py-2.5 px-3 rounded-xl border border-stone-300 hover:bg-stone-100 text-stone-700 text-xs font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                    <span>Skip Lead</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsFollowUpOpen(true)}
                    className="py-2.5 px-2.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                    title="Generate 1-click WhatsApp, Email, or SMS message"
                  >
                    <MessageSquareText className="w-3.5 h-3.5 text-amber-700" />
                    <span className="hidden sm:inline">Smart Follow-Up</span>
                  </button>
                </div>

                <div className="flex-1 flex flex-col sm:flex-row items-stretch gap-2">
                  {autoAdvanceEnabled && (
                    <button
                      type="button"
                      onClick={() => executeSave(false)}
                      disabled={isSubmitting}
                      className="flex-1 py-2.5 px-3 bg-stone-800 hover:bg-stone-900 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      title="Log call and start 5-second countdown to next lead"
                    >
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>Log &amp; Countdown (5s)</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => executeSave(true)}
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 px-3 bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Log call and jump straight to the next lead"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Log &amp; Immediately Advance ➔</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Objection Rebuttals & Call Scripts Panel */}
          {showObjections && (
            <div className="lg:col-span-5 flex flex-col">
              <ObjectionDrawer
                lead={currentLead}
                onSelectRebuttal={(text) => {
                  setFullNotes((prev) => (prev ? `${prev}\n\n[Rebuttal Applied]: ${text}` : `[Rebuttal Applied]: ${text}`));
                }}
                className="h-full min-h-[26rem]"
              />
            </div>
          )}
        </div>
      </div>

      {/* Smart Follow-Up Modal */}
      {currentLead && (
        <SmartFollowUpModal
          isOpen={isFollowUpOpen}
          onClose={() => setIsFollowUpOpen(false)}
          lead={currentLead}
          outcomeTag={outcome}
          callNotes={fullNotes || summary}
        />
      )}
    </div>
  );
};
