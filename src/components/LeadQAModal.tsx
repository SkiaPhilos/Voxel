import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  ClipboardList,
  Plus,
  Trash2,
  Check,
  Copy,
  Clock,
  MessageSquare,
  PhoneCall,
  Mic,
  ChevronDown,
  ChevronUp,
  Sparkles,
  HelpCircle,
  Package,
  DollarSign,
  Building2,
  Calendar,
} from 'lucide-react';
import type { Lead, LeadQAEntry, LeadQASession, User } from '../types';
import { api } from '../lib/api';

export interface PresetQAConfig {
  id: string;
  name: string;
  category: string;
  icon: React.ElementType;
  description: string;
  questions: Array<{
    question: string;
    suggestions?: string[];
    placeholder?: string;
  }>;
}

export const QA_PRESETS: PresetQAConfig[] = [
  {
    id: 'courier_logistics',
    name: 'Courier & Shipping',
    category: 'Courier Logistics',
    icon: Package,
    description: 'Standard daily parcels, locations & active courier provider',
    questions: [
      {
        question: 'Location / Address: ?',
        placeholder: 'e.g. Johar Town, Lahore or Saddar, Karachi',
        suggestions: ['Lahore', 'Karachi', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan', 'Peshawar', 'Sialkot'],
      },
      {
        question: 'Number of Daily Parcels: ?',
        placeholder: 'e.g. 25 parcels/day',
        suggestions: ['< 10/day', '10-25/day', '25-50/day', '50-100/day', '100-250/day', '250+/day'],
      },
      {
        question: 'Business / Industry: ?',
        placeholder: 'e.g. Women Apparel, Cosmetics, Electronics',
        suggestions: ['Clothing & Fashion', 'Cosmetics & Skincare', 'Electronics & Gadgets', 'Shoes & Leather', 'Home & Living', 'General E-Commerce'],
      },
      {
        question: 'Current Courier Service Provider: ?',
        placeholder: 'e.g. TCS, Leopards, Trax, PostEx',
        suggestions: ['TCS', 'Leopards', 'PostEx', 'Trax', 'CallCourier', 'M&P', 'Swyft', 'Rider', 'Self Delivery'],
      },
      {
        question: 'Average Parcel Weight / Size: ?',
        placeholder: 'e.g. 0.5 kg to 1 kg flyers',
        suggestions: ['0.5 kg (Flyer)', '1 kg', '2 - 3 kg', 'Heavy / Bulky (> 5 kg)'],
      },
      {
        question: 'Current Pain Point / Delivery Issues: ?',
        placeholder: 'e.g. Delayed COD remittance, High return rate',
        suggestions: ['Delayed COD payment', 'High return rate (RTO)', 'Slow intercity delivery', 'Customer portal/tracking', 'High shipping rates'],
      },
    ],
  },
  {
    id: 'cod_financial',
    name: 'COD & Payment Cycle',
    category: 'COD & Finance',
    icon: DollarSign,
    description: 'Cash-on-delivery settlements, rate card & monthly budget',
    questions: [
      {
        question: 'COD Settlement Cycle Needed: ?',
        placeholder: 'e.g. 24-hour daily COD, Twice weekly',
        suggestions: ['24-Hour Daily Settlement', 'Twice Weekly', 'Weekly Payment', 'Fortnightly'],
      },
      {
        question: 'Current Delivery Rate / Tariff Paid: ?',
        placeholder: 'e.g. Rs. 180 base rate within city, Rs. 240 nationwide',
        suggestions: ['Rs. 150-180', 'Rs. 180-220', 'Rs. 220-260', 'Rs. 280+'],
      },
      {
        question: 'Monthly Shipping Volume / Spend: ?',
        placeholder: 'e.g. Rs. 80,000 to Rs. 200,000 / month',
        suggestions: ['< Rs. 50,000', 'Rs. 50k - 150k', 'Rs. 150k - 300k', 'Rs. 300k - 1M+'],
      },
      {
        question: 'Return / RTO (Return to Origin) %: ?',
        placeholder: 'e.g. 8% return rate currently',
        suggestions: ['< 5%', '5% - 10%', '10% - 15%', '15% - 25% (High)'],
      },
      {
        question: 'Preferred Bank for COD Transfer: ?',
        placeholder: 'e.g. Meezan Bank, HBL, Bank Alfalah',
        suggestions: ['Meezan Bank', 'HBL', 'Bank Alfalah', 'MCB', 'EasyPaisa / JazzCash'],
      },
    ],
  },
  {
    id: 'enterprise_b2b',
    name: 'B2B & Enterprise Operations',
    category: 'Enterprise Logistics',
    icon: Building2,
    description: 'Multi-warehouse logistics, branch pickups & decision makers',
    questions: [
      {
        question: 'Number of Warehouses / Dispatch Centers: ?',
        placeholder: 'e.g. 2 dispatch points (Lahore & Karachi)',
        suggestions: ['1 Central Warehouse', '2 Branches (LHR/KHI)', '3+ Nationwide Hubs'],
      },
      {
        question: 'Daily Pickup Timing & Frequency: ?',
        placeholder: 'e.g. Evening 6 PM daily pickup',
        suggestions: ['Daily Evening (5-7 PM)', 'Twice Daily (2 PM & 7 PM)', 'On-Demand Pickup'],
      },
      {
        question: 'Flyers & Packaging Material Needed: ?',
        placeholder: 'e.g. 1,000 small flyers per month',
        suggestions: ['Small Flyers (500/mo)', 'Medium/Large Flyers (1000/mo)', 'Boxes Required', 'Uses Own Custom Branding'],
      },
      {
        question: 'Key Decision Maker & Direct Phone: ?',
        placeholder: 'e.g. Mr. Usman (Director) - 0300...',
        suggestions: ['Business Owner', 'Operations Manager', 'Supply Chain Head'],
      },
      {
        question: 'Expected Onboarding / Trial Date: ?',
        placeholder: 'e.g. Starting trial parcels next Monday',
        suggestions: ['Immediately / Tomorrow', 'Next Monday', 'Start of Next Month', 'Comparing options'],
      },
    ],
  },
];

interface LeadQAModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: (updatedLead: Lead) => void;
  currentUser?: User | null;
}

export const LeadQAModal: React.FC<LeadQAModalProps> = ({
  lead,
  isOpen,
  onClose,
  onSaveSuccess,
  currentUser,
}) => {
  const [activePresetId, setActivePresetId] = useState<string>('courier_logistics');
  const [qaEntries, setQaEntries] = useState<Array<{ id: string; question: string; answer: string; category?: string }>>([]);
  const [channel, setChannel] = useState<'call' | 'msg' | 'voice' | 'manual'>('call');
  const [sessionNotes, setSessionNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [customQuestionInput, setCustomQuestionInput] = useState('');
  const [isAddingCustom, setIsAddingCustom] = useState(false);

  // Initialize or populate entries when modal opens with a lead
  useEffect(() => {
    if (!isOpen || !lead) return;

    // 1. If lead already has qa_entries or qa_data, reconstruct entries
    const existingMap: Record<string, string> = { ...(lead.qa_data || {}) };
    if (lead.qa_entries && lead.qa_entries.length > 0) {
      lead.qa_entries.forEach((e) => {
        if (e.question) existingMap[e.question] = e.answer;
      });
    }

    // Also parse lead.business_info if qa_data is empty
    if (Object.keys(existingMap).length === 0 && lead.business_info) {
      const lines = lead.business_info.split('\n');
      for (const line of lines) {
        const parts = line.split(':');
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const val = parts.slice(1).join(':').trim();
          if (key && val) {
            existingMap[key.endsWith('?') ? key : `${key}: ?`] = val;
          }
        }
      }
    }

    // Default questions from the initial active preset
    const defaultPreset = QA_PRESETS.find((p) => p.id === activePresetId) || QA_PRESETS[0];
    const initialList: Array<{ id: string; question: string; answer: string; category?: string }> = [];

    // Add preset questions
    defaultPreset.questions.forEach((q, idx) => {
      initialList.push({
        id: `qa_${defaultPreset.id}_${idx}`,
        question: q.question,
        answer: existingMap[q.question] || existingMap[q.question.replace(': ?', '')] || '',
        category: defaultPreset.category,
      });
    });

    // Also add any other questions the lead had stored that are outside this preset
    Object.keys(existingMap).forEach((qKey, idx) => {
      const alreadyAdded = initialList.some(
        (i) => i.question.toLowerCase() === qKey.toLowerCase()
      );
      if (!alreadyAdded && existingMap[qKey]) {
        initialList.push({
          id: `qa_existing_${idx}_${Date.now()}`,
          question: qKey.endsWith('?') ? qKey : `${qKey}: ?`,
          answer: existingMap[qKey],
          category: 'Existing Record',
        });
      }
    });

    setQaEntries(initialList);
    setSessionNotes('');
    setIsAddingCustom(false);
    setCustomQuestionInput('');
  }, [isOpen, lead?.id]);

  if (!isOpen || !lead) return null;

  // Switch or merge preset questions
  const handleSelectPreset = (presetId: string) => {
    setActivePresetId(presetId);
    const selectedPreset = QA_PRESETS.find((p) => p.id === presetId);
    if (!selectedPreset) return;

    setQaEntries((prev) => {
      const existingAnswers: Record<string, string> = {};
      prev.forEach((item) => {
        if (item.answer) {
          existingAnswers[item.question] = item.answer;
        }
      });

      // Keep existing items and add newly selected preset questions that are missing
      const nextList = [...prev];
      selectedPreset.questions.forEach((q, idx) => {
        const found = nextList.find((item) => item.question === q.question);
        if (!found) {
          nextList.push({
            id: `qa_${selectedPreset.id}_${idx}_${Date.now()}`,
            question: q.question,
            answer: existingAnswers[q.question] || '',
            category: selectedPreset.category,
          });
        }
      });
      return nextList;
    });
  };

  const handleUpdateAnswer = (id: string, newAnswer: string) => {
    setQaEntries((prev) =>
      prev.map((item) => (item.id === id ? { ...item, answer: newAnswer } : item))
    );
  };

  const handleApplySuggestion = (id: string, suggestion: string) => {
    setQaEntries((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        // If empty, set directly. If not empty, append if not already there
        if (!item.answer) return { ...item, answer: suggestion };
        if (item.answer.includes(suggestion)) return item;
        return { ...item, answer: `${item.answer}, ${suggestion}` };
      })
    );
  };

  const handleRemoveField = (id: string) => {
    setQaEntries((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAddCustomField = () => {
    const trimmed = customQuestionInput.trim();
    if (!trimmed) return;

    const formatted = trimmed.endsWith('?') ? trimmed : `${trimmed}: ?`;
    const newId = `qa_custom_${Date.now()}`;

    setQaEntries((prev) => [
      ...prev,
      {
        id: newId,
        question: formatted,
        answer: '',
        category: 'Custom Question',
      },
    ]);

    setCustomQuestionInput('');
    setIsAddingCustom(false);
  };

  // Copy full QA summary to clipboard
  const handleCopyAll = () => {
    const answered = qaEntries.filter((e) => e.answer.trim());
    if (answered.length === 0) return;

    const lines = [
      `📋 Lead Qualification Q&A: ${lead.name} (${lead.phone})`,
      `Channel: ${channel.toUpperCase()} | Captured by: ${currentUser?.name || 'Agent'}`,
      '----------------------------------------',
      ...answered.map((e) => `${e.question.replace(/: \?$/, '')}: ${e.answer}`),
    ];
    if (sessionNotes.trim()) {
      lines.push('----------------------------------------');
      lines.push(`Session Notes: ${sessionNotes.trim()}`);
    }

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  // Save QA data to database
  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Build clean qa_data key-value dictionary
      const qaDataMap: Record<string, string> = {};
      const validEntries: LeadQAEntry[] = [];

      qaEntries.forEach((e) => {
        const cleanAnswer = e.answer.trim();
        if (cleanAnswer) {
          const cleanQ = e.question.trim();
          qaDataMap[cleanQ] = cleanAnswer;
          validEntries.push({
            id: e.id,
            question: cleanQ,
            answer: cleanAnswer,
            category: e.category,
            updated_at: new Date().toISOString(),
            updated_by: currentUser?.name || currentUser?.email || 'Agent',
          });
        }
      });

      // Construct a new session object
      const nowIso = new Date().toISOString();
      const newSession: LeadQASession = {
        id: `qasess_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: nowIso,
        channel,
        logged_by: currentUser?.id,
        logged_by_name: currentUser?.name || 'Agent',
        summary: sessionNotes.trim() || undefined,
        answers: qaDataMap,
      };

      const updatedSessions = [newSession, ...(lead.qa_sessions || [])];

      const payload = {
        qa_data: qaDataMap,
        qa_entries: validEntries,
        qa_sessions: updatedSessions,
        business_info: lead.business_info,
      };

      const res = await api.updateLeadQA(lead.id, payload);
      onSaveSuccess(res.lead);
      onClose();
    } catch (err) {
      console.error('Failed to save Lead QA data', err);
      alert('Failed to save Q&A data. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const answeredCount = qaEntries.filter((e) => e.answer.trim()).length;
  const totalCount = qaEntries.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl max-h-[92vh] rounded-3xl shadow-2xl border border-stone-200 flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-amber-50 via-white to-stone-50 border-b border-stone-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-700 text-white flex items-center justify-center shadow-xs shrink-0">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-stone-900 truncate">
                  Lead Q&amp;A Sets
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  {answeredCount} / {totalCount} Answered
                </span>
                {lead.qa_sessions && lead.qa_sessions.length > 0 && (
                  <span className="text-[11px] text-stone-500 font-medium">
                    ({lead.qa_sessions.length} session{lead.qa_sessions.length === 1 ? '' : 's'})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-stone-500 mt-0.5">
                <span className="font-semibold text-stone-800">{lead.name}</span>
                <span>•</span>
                <span className="font-mono text-stone-600">{lead.phone}</span>
                {lead.status && (
                  <>
                    <span>•</span>
                    <span className="px-1.5 py-0.2 rounded bg-stone-100 text-stone-700 text-[10px]">
                      {lead.status}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {answeredCount > 0 && (
              <button
                type="button"
                onClick={handleCopyAll}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-stone-600 hover:text-stone-900 hover:bg-stone-100 text-xs font-semibold border border-stone-200 transition-colors cursor-pointer"
                title="Copy all answers to clipboard"
              >
                {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{copiedAll ? 'Copied!' : 'Copy QA'}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
              title="Close Q&A pop up"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Channel / Session Context Selector */}
          <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200/80 flex flex-wrap items-center justify-between gap-2.5">
            <span className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-700" />
              <span>Capture Session Via:</span>
            </span>

            <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-stone-200 text-xs">
              <button
                type="button"
                onClick={() => setChannel('call')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  channel === 'call' ? 'bg-amber-700 text-white shadow-2xs' : 'text-stone-600 hover:bg-stone-50'
                }`}
              >
                <PhoneCall className="w-3 h-3" />
                <span>Call Session</span>
              </button>
              <button
                type="button"
                onClick={() => setChannel('msg')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  channel === 'msg' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-stone-600 hover:bg-stone-50'
                }`}
              >
                <MessageSquare className="w-3 h-3" />
                <span>WhatsApp / Msg</span>
              </button>
              <button
                type="button"
                onClick={() => setChannel('voice')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  channel === 'voice' ? 'bg-purple-600 text-white shadow-2xs' : 'text-stone-600 hover:bg-stone-50'
                }`}
              >
                <Mic className="w-3 h-3" />
                <span>Voice Audio</span>
              </button>
            </div>
          </div>

          {/* 3 PRESETS SELECTION BAR */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Choose QA Preset:</span>
              </label>
              <span className="text-[11px] text-stone-400">Click to switch or load question sets</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {QA_PRESETS.map((preset) => {
                const IconComponent = preset.icon;
                const isActive = activePresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset.id)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isActive
                        ? 'bg-amber-50/80 border-amber-400 shadow-2xs ring-2 ring-amber-500/20'
                        : 'bg-white border-stone-200 hover:border-amber-300 hover:bg-stone-50/60'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                          isActive ? 'bg-amber-700 text-white' : 'bg-stone-100 text-stone-600'
                        }`}
                      >
                        <IconComponent className="w-3.5 h-3.5" />
                      </div>
                      <span className={`text-xs font-bold ${isActive ? 'text-amber-950' : 'text-stone-800'}`}>
                        {preset.name}
                      </span>
                    </div>
                    <p className="text-[10px] text-stone-500 line-clamp-1">{preset.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* QUESTIONS & ANSWERS LIST */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-amber-700" />
                <span>Questions To Ask &amp; Fill:</span>
              </h4>

              <button
                type="button"
                onClick={() => setIsAddingCustom(true)}
                className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-200 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add More Info</span>
              </button>
            </div>

            {/* Custom Question Input Form */}
            {isAddingCustom && (
              <div className="p-3.5 bg-amber-50/70 border border-amber-300 rounded-2xl space-y-2 animate-in fade-in duration-150">
                <label className="text-xs font-bold text-amber-950 block">
                  Add Custom Field / Question:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    autoFocus
                    value={customQuestionInput}
                    onChange={(e) => setCustomQuestionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomField();
                      }
                    }}
                    placeholder="e.g. Special Delivery Hours: ? or Flyer Branding: ?"
                    className="flex-1 px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-amber-700"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomField}
                    disabled={!customQuestionInput.trim()}
                    className="px-3 py-2 bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Add Field
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingCustom(false);
                      setCustomQuestionInput('');
                    }}
                    className="px-2.5 py-2 text-stone-500 hover:text-stone-800 text-xs font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Render Each Question Field */}
            {qaEntries.map((item) => {
              // Find preset suggestion chips if available
              const presetDef = QA_PRESETS.flatMap((p) => p.questions).find(
                (q) => q.question.toLowerCase() === item.question.toLowerCase()
              );
              const suggestions = presetDef?.suggestions;

              return (
                <div
                  key={item.id}
                  className="p-3.5 bg-white rounded-2xl border border-stone-200/90 shadow-2xs hover:border-amber-300 transition-all space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-extrabold text-stone-900 font-sans">
                        {item.question}
                      </span>
                      {item.category && (
                        <span className="px-1.5 py-0.2 rounded bg-stone-100 text-stone-500 text-[10px] font-mono">
                          {item.category}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveField(item.id)}
                      className="text-stone-300 hover:text-rose-600 p-1 transition-colors cursor-pointer"
                      title="Remove this question field"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <input
                    type="text"
                    value={item.answer}
                    onChange={(e) => handleUpdateAnswer(item.id, e.target.value)}
                    placeholder={presetDef?.placeholder || 'Agent types answers here during call...'}
                    className="w-full px-3 py-2 bg-[#FBF9F5] border border-stone-200 rounded-xl text-xs text-stone-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-700 transition-all font-sans"
                  />

                  {/* Suggestion Pills for 1-Tap Agent Selection */}
                  {suggestions && suggestions.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 pt-1">
                      <span className="text-[10px] font-semibold text-stone-400 mr-1">Quick Select:</span>
                      {suggestions.map((sug) => {
                        const isSelected = item.answer.toLowerCase().includes(sug.toLowerCase());
                        return (
                          <button
                            key={sug}
                            type="button"
                            onClick={() => handleApplySuggestion(item.id, sug)}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-amber-100 border-amber-300 text-amber-900 font-bold'
                                : 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-600'
                            }`}
                          >
                            {isSelected ? '✓ ' : '+ '}
                            {sug}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Session Context / Call Notes (Optional) */}
          <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-1.5">
            <label className="text-xs font-bold text-stone-700 block">
              Additional Session Context / Agent Notes (Optional):
            </label>
            <textarea
              rows={2}
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
              placeholder="e.g. Spoke with owner, agreed to test 10 trial deliveries next Tuesday..."
              className="w-full p-2.5 bg-white border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-amber-700"
            />
          </div>

          {/* Past Q&A Sessions History Accordion */}
          {lead.qa_sessions && lead.qa_sessions.length > 0 && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className="w-full py-2 px-3 bg-stone-100 hover:bg-stone-200 rounded-xl text-xs font-semibold text-stone-700 flex items-center justify-between transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-amber-700" />
                  <span>Collected Over {lead.qa_sessions.length} Previous Sessions</span>
                </div>
                {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showHistory && (
                <div className="mt-2 space-y-2 max-h-56 overflow-y-auto pr-1">
                  {lead.qa_sessions.map((sess, idx) => (
                    <div
                      key={sess.id || idx}
                      className="p-3 bg-white rounded-xl border border-stone-200 text-xs space-y-1.5 shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-stone-800">
                          {sess.logged_by_name || 'Agent'} ({sess.channel || 'call'})
                        </span>
                        <span className="text-[10px] text-stone-400 font-mono">
                          {new Date(sess.timestamp).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      {sess.summary && (
                        <p className="text-[11px] text-stone-600 italic">"{sess.summary}"</p>
                      )}
                      <div className="text-[11px] text-stone-700 grid grid-cols-1 sm:grid-cols-2 gap-1 pt-1 border-t border-stone-100">
                        {Object.entries(sess.answers || {}).map(([q, a]) => (
                          <div key={q} className="truncate">
                            <span className="font-medium text-stone-500">{q.replace(': ?', '')}:</span>{' '}
                            <span className="font-bold text-stone-800">{a}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="px-5 py-3.5 bg-stone-50 border-t border-stone-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 active:bg-amber-900 disabled:opacity-60 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              {isSaving ? (
                <span>Saving Data...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save &amp; Link Q&amp;A</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
