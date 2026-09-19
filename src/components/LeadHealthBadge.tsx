import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Flame,
  Sun,
  Snowflake,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  X,
  ArrowRight,
  ShieldAlert,
  Cpu,
  Info,
} from 'lucide-react';
import type { Lead, LeadHealthAssessment } from '../types';
import { api } from '../lib/api';

interface LeadHealthBadgeProps {
  lead: Lead;
  onLeadUpdated?: (updatedLead: Lead) => void;
  size?: 'sm' | 'md' | 'lg';
  showDetailsOnClick?: boolean;
}

export const LeadHealthBadge: React.FC<LeadHealthBadgeProps> = ({
  lead,
  onLeadUpdated,
  size = 'sm',
  showDetailsOnClick = true,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentHealth, setCurrentHealth] = useState<LeadHealthAssessment | null>(lead.ai_health || null);

  // Compute fallback score if not yet analyzed by AI
  const lastTouchDate = lead.call_logs?.[0]?.timestamp || lead.updated_at || lead.created_at;
  const daysCold = Math.max(0, Math.floor((Date.now() - new Date(lastTouchDate).getTime()) / (1000 * 60 * 60 * 24)));

  const handleAnalyzeHealth = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsLoading(true);
    try {
      const res = await api.getLeadHealth({ leadId: lead.id, daysCold });
      if (res.health) {
        setCurrentHealth(res.health);
        if (onLeadUpdated) {
          onLeadUpdated({
            ...lead,
            ai_health: res.health,
          });
        }
      }
    } catch (err) {
      console.error('Failed to analyze lead health:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Derive display values from currentHealth or lightweight heuristics
  let score = currentHealth?.healthScore;
  let category = currentHealth?.category;

  if (score === undefined) {
    // Quick default preview based on daysCold & last outcome
    const lastOutcome = lead.call_logs?.[0]?.outcome_tag;
    let base = 65;
    if (daysCold > 7) base -= 25;
    else if (daysCold <= 1) base += 15;
    if (lastOutcome === 'Interested') base += 20;
    if (lastOutcome === 'Closed/Matured') base = 95;
    if (lastOutcome === 'Service Denied') base = 15;
    score = Math.max(10, Math.min(99, base));
    if (score >= 80) category = 'Hot';
    else if (score >= 60) category = 'Warm';
    else if (score >= 35) category = 'Cooling';
    else category = 'At-Risk';
  }

  const getStyle = () => {
    switch (category) {
      case 'Hot':
        return {
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100',
          icon: <Flame className="w-3 h-3 text-emerald-600 fill-emerald-500/20" />,
          label: 'Hot Lead',
          dot: 'bg-emerald-500',
        };
      case 'Warm':
        return {
          bg: 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100',
          icon: <Sun className="w-3 h-3 text-amber-600" />,
          label: 'Warm',
          dot: 'bg-amber-500',
        };
      case 'Cooling':
        return {
          bg: 'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100',
          icon: <Snowflake className="w-3 h-3 text-sky-600" />,
          label: 'Cooling',
          dot: 'bg-sky-500',
        };
      case 'At-Risk':
      default:
        return {
          bg: 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100',
          icon: <AlertTriangle className="w-3 h-3 text-rose-600" />,
          label: 'At-Risk',
          dot: 'bg-rose-500',
        };
    }
  };

  const style = getStyle();

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          if (showDetailsOnClick) {
            e.stopPropagation();
            setIsModalOpen(true);
            if (!currentHealth) {
              handleAnalyzeHealth();
            }
          }
        }}
        title={`Account Health: ${score}/100 (${category}). Click for diagnosis.`}
        className={`inline-flex items-center gap-1.5 font-semibold rounded-lg border transition-all cursor-pointer ${style.bg} ${
          size === 'sm'
            ? 'px-2 py-0.5 text-[11px]'
            : size === 'md'
            ? 'px-2.5 py-1 text-xs'
            : 'px-3 py-1.5 text-sm'
        }`}
      >
        {style.icon}
        <span>{score}</span>
        <span className="text-[10px] font-medium opacity-80">{style.label}</span>
      </button>

      {/* AI Health & Churn Risk Modal rendered via React Portal to prevent CSS transform trapping */}
      {isModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs"
            onClick={(e) => {
              e.stopPropagation();
              setIsModalOpen(false);
            }}
          >
            <div
              className="w-full max-w-md max-h-[90vh] flex flex-col bg-white border border-stone-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50/90 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-700 text-amber-50 flex items-center justify-center shadow-xs">
                    {currentHealth?.isAiPowered ? (
                      <Sparkles className="w-4 h-4" />
                    ) : (
                      <Cpu className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-stone-900">Lead Health &amp; Churn Risk</h3>
                    <p className="text-xs text-stone-500 font-medium">{lead.name}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Modal Content */}
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 overscroll-contain">
                {/* Engine Source Banner (Explicit Heuristic vs Gemini Mode) */}
                {currentHealth?.isAiPowered ? (
                  <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200 flex items-center justify-between text-xs text-emerald-900">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span className="font-semibold">AI Analysis Active</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-medium">
                      {currentHealth.modelUsed || 'Gemini'}
                    </span>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-stone-100/90 border border-stone-200/90 flex items-start gap-2 text-xs text-stone-700">
                    <Info className="w-3.5 h-3.5 text-stone-500 shrink-0 mt-0.5" />
                    <div className="leading-tight">
                      <span className="font-semibold text-stone-900">Rule-Based Estimation</span>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        Gemini API key is not yet configured in Admin Settings. Calculating health from touch frequency and outcome cadence.
                      </p>
                    </div>
                  </div>
                )}

                {/* Score Highlight Box */}
                <div className="flex items-center justify-between p-4 rounded-xl border border-stone-200 bg-stone-50">
                  <div>
                    <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-0.5">
                      Conversion Health
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-stone-900">{score}</span>
                      <span className="text-xs text-stone-500">/ 100</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${style.bg}`}>
                        {category}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-0.5">
                      Churn Risk
                    </span>
                    <span
                      className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${
                        currentHealth?.churnRisk === 'Critical'
                          ? 'bg-rose-100 text-rose-800'
                          : currentHealth?.churnRisk === 'High'
                          ? 'bg-amber-100 text-amber-800'
                          : currentHealth?.churnRisk === 'Medium'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {currentHealth?.churnRisk || (daysCold > 5 ? 'High' : 'Medium')} Risk
                    </span>
                  </div>
                </div>

                {/* Risk Diagnosis */}
                <div>
                  <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
                    <span>Risk Diagnosis</span>
                  </h4>
                  <div className="p-3 bg-amber-50/50 border border-amber-200/60 rounded-xl text-xs text-stone-800 leading-relaxed">
                    {currentHealth?.riskDiagnosis || (
                      <span>
                        Lead has been cold for <strong>{daysCold} days</strong>. Last outcome was{' '}
                        <strong>{lead.call_logs?.[0]?.outcome_tag || 'Never Contacted'}</strong>. Prompt re-engagement
                        prevents contact fatigue.
                      </span>
                    )}
                  </div>
                </div>

                {/* Recommended Tactic */}
                <div>
                  <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <ArrowRight className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Recommended Next Step</span>
                  </h4>
                  <div className="p-3 bg-emerald-50/50 border border-emerald-200/60 rounded-xl text-xs text-stone-800 font-medium leading-relaxed">
                    {currentHealth?.recommendedTactic ||
                      'Switch outreach to a short WhatsApp or SMS message during morning peak response hours (9:30 AM - 11:30 AM).'}
                  </div>
                </div>

                {/* Signal Indicators / Decay Factors */}
                {currentHealth?.decayFactors && currentHealth.decayFactors.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                      Signal Indicators
                    </h4>
                    <ul className="space-y-1">
                      {currentHealth.decayFactors.map((factor, idx) => (
                        <li
                          key={idx}
                          className="text-xs text-stone-600 flex items-center gap-2 p-2 bg-stone-50 rounded-lg border border-stone-100"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
                          <span>{factor}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-stone-200 bg-stone-50/90 flex items-center justify-between shrink-0">
                <span className="text-[11px] text-stone-400 font-medium">
                  {currentHealth?.isAiPowered
                    ? `Powered by Gemini ${currentHealth.modelUsed || ''}`
                    : 'Rule-Based Engine'}
                </span>
                <button
                  type="button"
                  onClick={() => handleAnalyzeHealth()}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>{isLoading ? 'Analyzing...' : 'Re-calculate'}</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
