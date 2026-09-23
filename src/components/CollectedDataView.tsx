import React, { useState, useMemo } from 'react';
import {
  Database,
  Search,
  Download,
  Filter,
  Package,
  DollarSign,
  Building2,
  HelpCircle,
  CheckCircle2,
  Clock,
  Plus,
  Copy,
  Check,
  Phone,
  MessageCircle,
  ExternalLink,
  ClipboardList,
  Save,
  RotateCcw,
  Sparkles,
  ChevronRight,
  ArrowLeft,
  X,
  UserCheck,
  AlertCircle,
} from 'lucide-react';
import type { Lead, LeadQAEntry, LeadQASession, User } from '../types';
import { QA_PRESETS } from './LeadQAModal';
import { api } from '../lib/api';
import { generateLeadsCsv } from '../lib/csvExportUtils';
import { formatPhoneForDialer, getWhatsAppUrl } from '../lib/contactUtils';
import { formatPhoneDisplay } from '../lib/countries';

interface CollectedDataViewProps {
  leads: Lead[];
  onOpenQA: (lead: Lead) => void;
  onOpenDetail: (lead: Lead) => void;
  onLogCall?: (lead: Lead) => void;
  onLeadUpdated: (updatedLead: Lead) => void;
  currentUser?: User | null;
}

export const CollectedDataView: React.FC<CollectedDataViewProps> = ({
  leads,
  onOpenQA,
  onOpenDetail,
  onLogCall,
  onLeadUpdated,
  currentUser,
}) => {
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(leads[0]?.id || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'has_answers' | 'no_answers'>('all');
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  // Inline editing state for the active lead's answers
  const [editingAnswers, setEditingAnswers] = useState<Record<string, string>>({});
  const [customQuestions, setCustomQuestions] = useState<string[]>([]);
  const [newCustomQuestionInput, setNewCustomQuestionInput] = useState('');
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [isSavingInline, setIsSavingInline] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);

  // Keep selected lead synchronized
  const selectedLead = useMemo(() => {
    return leads.find((l) => l.id === selectedLeadId) || leads[0] || null;
  }, [leads, selectedLeadId]);

  // Synchronize local editing state when selected lead changes
  React.useEffect(() => {
    if (selectedLead) {
      setEditingAnswers({ ...(selectedLead.qa_data || {}) });
      // Detect any custom questions that are not in presets
      const presetQuestionSet = new Set(
        QA_PRESETS.flatMap((p) => p.questions.map((q) => q.question.toLowerCase().trim()))
      );
      const customQList: string[] = [];
      if (selectedLead.qa_data) {
        Object.keys(selectedLead.qa_data).forEach((qKey) => {
          if (!presetQuestionSet.has(qKey.toLowerCase().trim())) {
            customQList.push(qKey);
          }
        });
      }
      if (Array.isArray(selectedLead.qa_entries)) {
        selectedLead.qa_entries.forEach((entry) => {
          if (entry.question && !presetQuestionSet.has(entry.question.toLowerCase().trim())) {
            if (!customQList.includes(entry.question)) {
              customQList.push(entry.question);
            }
          }
        });
      }
      setCustomQuestions(customQList);
      setShowAddCustom(false);
      setNewCustomQuestionInput('');
    }
  }, [selectedLead?.id]);

  // Helper to count answered questions for any lead
  const getAnsweredCount = (lead: Lead) => {
    if (!lead.qa_data) return 0;
    return Object.values(lead.qa_data).filter((v) => typeof v === 'string' && v.trim().length > 0).length;
  };

  // Filtered leads list
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const answeredCount = getAnsweredCount(lead);
      if (statusFilter === 'has_answers' && answeredCount === 0) return false;
      if (statusFilter === 'no_answers' && answeredCount > 0) return false;

      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase().trim();

      // Search in lead profile
      if (lead.name.toLowerCase().includes(query)) return true;
      if (lead.phone.toLowerCase().includes(query)) return true;
      if (lead.email && lead.email.toLowerCase().includes(query)) return true;
      if (lead.business_notes && lead.business_notes.toLowerCase().includes(query)) return true;

      // Search in QA questions and answers
      if (lead.qa_data) {
        for (const [q, a] of Object.entries(lead.qa_data)) {
          if (q.toLowerCase().includes(query) || String(a).toLowerCase().includes(query)) {
            return true;
          }
        }
      }
      return false;
    });
  }, [leads, searchQuery, statusFilter]);

  // High-level statistics
  const totalLeadsCount = leads.length;
  const leadsWithAnswersCount = useMemo(() => {
    return leads.filter((l) => getAnsweredCount(l) > 0).length;
  }, [leads]);
  const totalAnswersLogged = useMemo(() => {
    return leads.reduce((sum, l) => sum + getAnsweredCount(l), 0);
  }, [leads]);

  // Handle setting/updating an answer inline
  const handleAnswerChange = (question: string, value: string) => {
    setEditingAnswers((prev) => ({
      ...prev,
      [question]: value,
    }));
  };

  // Handle clicking a suggestion pill
  const handleApplySuggestion = (question: string, suggestion: string) => {
    setEditingAnswers((prev) => {
      const current = prev[question] || '';
      if (!current.trim()) {
        return { ...prev, [question]: suggestion };
      }
      if (current.includes(suggestion)) return prev;
      return { ...prev, [question]: `${current}, ${suggestion}` };
    });
  };

  // Add custom question
  const handleAddCustomQuestion = () => {
    const trimmed = newCustomQuestionInput.trim();
    if (!trimmed) return;
    const formatted = trimmed.endsWith('?') ? trimmed : `${trimmed}: ?`;
    if (!customQuestions.includes(formatted)) {
      setCustomQuestions((prev) => [...prev, formatted]);
    }
    setNewCustomQuestionInput('');
    setShowAddCustom(false);
  };

  // Save inline edits
  const handleSaveInline = async () => {
    if (!selectedLead) return;
    setIsSavingInline(true);
    try {
      const cleanData: Record<string, string> = {};
      const validEntries: LeadQAEntry[] = [];

      Object.entries(editingAnswers).forEach(([q, a]) => {
        const val = (a || '').trim();
        if (val) {
          cleanData[q] = val;
          validEntries.push({
            id: `entry_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            question: q,
            answer: val,
            category: 'Qualification Q&A',
            updated_at: new Date().toISOString(),
            updated_by: currentUser?.name || currentUser?.email || 'Agent',
          });
        }
      });

      const newSession: LeadQASession = {
        id: `qasess_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        channel: 'manual',
        logged_by: currentUser?.id,
        logged_by_name: currentUser?.name || 'Agent',
        summary: 'Collected data updated via Collected Data workspace',
        answers: cleanData,
      };

      const updatedSessions = [newSession, ...(selectedLead.qa_sessions || [])];

      const res = await api.updateLeadQA(selectedLead.id, {
        qa_data: cleanData,
        qa_entries: validEntries,
        qa_sessions: updatedSessions,
        business_info: selectedLead.business_info,
      });

      onLeadUpdated(res.lead);
      setSaveSuccessMsg(true);
      setTimeout(() => setSaveSuccessMsg(false), 2500);
    } catch (err) {
      console.error('Failed to save inline QA data:', err);
    } finally {
      setIsSavingInline(false);
    }
  };

  // Copy structured summary for active lead
  const handleCopySummary = () => {
    if (!selectedLead) return;
    const answeredPairs = Object.entries(editingAnswers).filter(([_, a]) => a && a.trim());
    if (answeredPairs.length === 0) return;

    const lines = [
      `📋 Collected Lead Data: ${selectedLead.name} (${selectedLead.phone})`,
      `Status: ${selectedLead.status} | Priority: ${selectedLead.priority}`,
      '----------------------------------------',
      ...answeredPairs.map(([q, a]) => `${q.replace(/: \?$/, '')}: ${a}`),
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  // Export CSV
  const handleExportCsv = () => {
    generateLeadsCsv(filteredLeads, 'coldcall_crm_collected_data');
  };

  return (
    <div className="space-y-4">
      {/* Top Header & KPI Bar */}
      <div className="bg-[#FAF8F5] border border-stone-200/90 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-100 text-amber-900 border border-amber-200">
                <Database className="w-5 h-5" />
              </span>
              <div>
                <h1 className="text-lg sm:text-xl font-black text-stone-900 tracking-tight flex items-center gap-2">
                  <span>Collected Data &amp; Lead Q&amp;A</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                    {totalLeadsCount} Total Leads
                  </span>
                </h1>
                <p className="text-xs text-stone-500 mt-0.5">
                  Universal workspace for qualification questions, operational logistics &amp; structured data sets.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-stone-50 text-stone-700 hover:text-stone-900 border border-stone-200/90 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              title="Download CSV with dynamic question columns at the end"
            >
              <Download className="w-4 h-4 text-amber-700" />
              <span>Export CSV with Q&amp;A</span>
            </button>
          </div>
        </div>

        {/* Metrics Counter Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-4 pt-4 border-t border-stone-200/80">
          <div className="bg-white/80 p-2.5 rounded-xl border border-stone-200/60">
            <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block">
              Qualified Leads
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-lg font-black text-stone-900">{leadsWithAnswersCount}</span>
              <span className="text-xs text-stone-400">/ {totalLeadsCount}</span>
            </div>
          </div>

          <div className="bg-white/80 p-2.5 rounded-xl border border-stone-200/60">
            <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block">
              Answers Captured
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-lg font-black text-amber-800">{totalAnswersLogged}</span>
              <span className="text-xs text-stone-400">fields filled</span>
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1 bg-white/80 p-2.5 rounded-xl border border-stone-200/60">
            <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block">
              Qualification Rate
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-lg font-black text-emerald-700">
                {totalLeadsCount > 0 ? Math.round((leadsWithAnswersCount / totalLeadsCount) * 100) : 0}%
              </span>
              <span className="text-xs text-stone-400">with answers</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Split Layout: Left Directory | Right Q&A Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Side: Leads Directory */}
        <div
          className={`lg:col-span-5 xl:col-span-4 bg-[#FAF8F5] border border-stone-200/90 rounded-2xl p-3.5 flex flex-col h-[750px] shadow-xs ${
            mobileDetailOpen ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Search and Filters */}
          <div className="space-y-2 pb-3 border-b border-stone-200/80">
            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search leads, phone, or answers..."
                className="w-full pl-9 pr-8 py-2 bg-white text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600 placeholder:text-stone-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Toggle Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto text-[11px]">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer shrink-0 ${
                  statusFilter === 'all'
                    ? 'bg-amber-700 text-white shadow-2xs'
                    : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
                }`}
              >
                All Leads ({leads.length})
              </button>
              <button
                onClick={() => setStatusFilter('has_answers')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer shrink-0 ${
                  statusFilter === 'has_answers'
                    ? 'bg-amber-700 text-white shadow-2xs'
                    : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
                }`}
              >
                Has Answers ({leadsWithAnswersCount})
              </button>
              <button
                onClick={() => setStatusFilter('no_answers')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer shrink-0 ${
                  statusFilter === 'no_answers'
                    ? 'bg-amber-700 text-white shadow-2xs'
                    : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
                }`}
              >
                No Data Yet ({leads.length - leadsWithAnswersCount})
              </button>
            </div>
          </div>

          {/* Leads Scroll List */}
          <div className="flex-1 overflow-y-auto space-y-2 mt-2.5 pr-1">
            {filteredLeads.length === 0 ? (
              <div className="text-center py-12 px-4">
                <AlertCircle className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-stone-600">No leads found</p>
                <p className="text-[11px] text-stone-400 mt-1">Try clearing your search query or filter.</p>
              </div>
            ) : (
              filteredLeads.map((lead) => {
                const isSelected = selectedLead?.id === lead.id;
                const answeredCount = getAnsweredCount(lead);
                const locationSnippet = lead.qa_data?.['Location / Address: ?'] || lead.qa_data?.['Location / Address'];
                const parcelsSnippet = lead.qa_data?.['Number of Daily Parcels: ?'] || lead.qa_data?.['Daily Parcels'];
                const courierSnippet = lead.qa_data?.['Current Courier Service Provider: ?'] || lead.qa_data?.['Current Courier'];

                return (
                  <div
                    key={lead.id}
                    onClick={() => {
                      setSelectedLeadId(lead.id);
                      setMobileDetailOpen(true);
                    }}
                    className={`p-3 rounded-xl border transition-all cursor-pointer text-left relative ${
                      isSelected
                        ? 'bg-amber-50/80 border-amber-300 ring-1 ring-amber-300/60 shadow-xs'
                        : 'bg-white hover:bg-stone-50/90 border-stone-200/80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="text-xs font-bold text-stone-900 truncate">{lead.name}</h3>
                          {lead.priority === 'High' && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              High
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-stone-500 font-mono mt-0.5">{formatPhoneDisplay(lead.phone)}</p>
                      </div>

                      {/* Answer count badge */}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                          answeredCount > 0
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-stone-100 text-stone-500 border-stone-200'
                        }`}
                      >
                        {answeredCount > 0 ? `${answeredCount} Answered` : 'No Data'}
                      </span>
                    </div>

                    {/* Quick Preview Snippet of Answered Data */}
                    {answeredCount > 0 && (
                      <div className="mt-2 pt-2 border-t border-stone-100 flex flex-wrap gap-1 text-[10px] text-stone-600">
                        {locationSnippet && (
                          <span className="px-1.5 py-0.5 rounded bg-stone-100 font-medium truncate max-w-[120px]">
                            📍 {locationSnippet}
                          </span>
                        )}
                        {parcelsSnippet && (
                          <span className="px-1.5 py-0.5 rounded bg-stone-100 font-medium truncate max-w-[110px]">
                            📦 {parcelsSnippet}
                          </span>
                        )}
                        {courierSnippet && (
                          <span className="px-1.5 py-0.5 rounded bg-stone-100 font-medium truncate max-w-[110px]">
                            🚚 {courierSnippet}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Detailed Question & Answer Sets for Selected Lead */}
        <div
          className={`lg:col-span-7 xl:col-span-8 bg-[#FAF8F5] border border-stone-200/90 rounded-2xl p-4 sm:p-5 flex flex-col h-[750px] shadow-xs ${
            !mobileDetailOpen ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {selectedLead ? (
            <>
              {/* Selected Lead Top Bar */}
              <div className="pb-3.5 border-b border-stone-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  {/* Mobile Back Button */}
                  <button
                    onClick={() => setMobileDetailOpen(false)}
                    className="p-1.5 rounded-lg bg-stone-200/70 text-stone-700 hover:bg-stone-300 transition-colors lg:hidden cursor-pointer"
                    title="Back to leads list"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-black text-stone-900 tracking-tight truncate">
                        {selectedLead.name}
                      </h2>
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-stone-100 text-stone-700 border border-stone-200">
                        {selectedLead.status}
                      </span>
                      {selectedLead.assigned_to_name && (
                        <span className="text-[11px] text-stone-500 font-medium">
                          Assigned: {selectedLead.assigned_to_name}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-1 text-xs text-stone-600">
                      <a
                        href={`tel:${formatPhoneForDialer(selectedLead.phone)}`}
                        className="inline-flex items-center gap-1 font-mono text-stone-800 hover:text-amber-800 font-semibold"
                      >
                        <Phone className="w-3 h-3 text-amber-700" />
                        <span>{formatPhoneDisplay(selectedLead.phone)}</span>
                      </a>
                      <a
                        href={getWhatsAppUrl(selectedLead.phone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-semibold"
                      >
                        <MessageCircle className="w-3 h-3" />
                        <span>WhatsApp</span>
                      </a>
                    </div>
                  </div>
                </div>

                {/* Lead Actions Toolbar */}
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  {/* Pop-up Modal Button */}
                  <button
                    type="button"
                    onClick={() => onOpenQA(selectedLead)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-100/80 hover:bg-amber-200/80 text-amber-900 border border-amber-300/80 text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                    title="Open Q&A Pop-up Window"
                  >
                    <ClipboardList className="w-3.5 h-3.5 text-amber-700" />
                    <span>Open Q&amp;A Pop-up</span>
                  </button>

                  {/* Copy Summary */}
                  <button
                    type="button"
                    onClick={handleCopySummary}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 text-xs font-semibold transition-colors cursor-pointer"
                    title="Copy Answered Q&A to Clipboard"
                  >
                    {copiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-stone-500" />}
                    <span>{copiedSummary ? 'Copied' : 'Copy'}</span>
                  </button>

                  {/* Open Detail Drawer */}
                  <button
                    type="button"
                    onClick={() => onOpenDetail(selectedLead)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 text-xs font-semibold transition-colors cursor-pointer"
                    title="Open Full Lead Dossier"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-stone-500" />
                    <span className="hidden sm:inline">Dossier</span>
                  </button>

                  {/* Save Inline Changes */}
                  <button
                    type="button"
                    onClick={handleSaveInline}
                    disabled={isSavingInline}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                  >
                    {isSavingInline ? (
                      <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                    ) : saveSuccessMsg ? (
                      <Check className="w-3.5 h-3.5 text-white" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>{isSavingInline ? 'Saving...' : saveSuccessMsg ? 'Saved!' : 'Save Answers'}</span>
                  </button>
                </div>
              </div>

              {/* Scrollable Question & Answer Sets */}
              <div className="flex-1 overflow-y-auto space-y-5 mt-4 pr-1">
                {/* 3 Structured Presets */}
                {QA_PRESETS.map((preset) => {
                  const Icon = preset.icon;
                  const answeredInPreset = preset.questions.filter(
                    (q) => editingAnswers[q.question] && editingAnswers[q.question].trim().length > 0
                  ).length;

                  return (
                    <div
                      key={preset.id}
                      className="bg-white rounded-xl border border-stone-200/90 overflow-hidden shadow-2xs"
                    >
                      {/* Preset Section Header */}
                      <div className="px-4 py-3 bg-[#FAF8F5] border-b border-stone-200/70 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 rounded-lg bg-amber-100 text-amber-900">
                            <Icon className="w-4 h-4" />
                          </span>
                          <div>
                            <h3 className="text-xs font-bold text-stone-900 tracking-tight">{preset.name}</h3>
                            <p className="text-[10px] text-stone-400">{preset.description}</p>
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                            answeredInPreset > 0
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-stone-100 text-stone-500 border-stone-200'
                          }`}
                        >
                          {answeredInPreset}/{preset.questions.length} Answered
                        </span>
                      </div>

                      {/* Question Fields in this Preset */}
                      <div className="p-3.5 space-y-3.5">
                        {preset.questions.map((qObj) => {
                          const currentVal = editingAnswers[qObj.question] || '';

                          return (
                            <div key={qObj.question} className="space-y-1.5">
                              <div className="flex items-baseline justify-between gap-2">
                                <label className="text-xs font-bold text-stone-800 flex items-center gap-1">
                                  <span>{qObj.question}</span>
                                </label>
                                {currentVal.trim() && (
                                  <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-0.5">
                                    <Check className="w-2.5 h-2.5" /> Answered
                                  </span>
                                )}
                              </div>

                              {/* Input field */}
                              <input
                                type="text"
                                value={currentVal}
                                onChange={(e) => handleAnswerChange(qObj.question, e.target.value)}
                                placeholder={qObj.placeholder || 'Type answer...'}
                                className={`w-full px-3 py-2 text-xs rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-amber-600/30 ${
                                  currentVal.trim()
                                    ? 'bg-amber-50/20 border-amber-200 font-medium text-stone-900'
                                    : 'bg-stone-50/60 border-stone-200 text-stone-700'
                                }`}
                              />

                              {/* Suggestion pills */}
                              {qObj.suggestions && qObj.suggestions.length > 0 && (
                                <div className="flex flex-wrap gap-1 pt-0.5">
                                  {qObj.suggestions.map((sug) => {
                                    const isSelected = currentVal.includes(sug);
                                    return (
                                      <button
                                        key={sug}
                                        type="button"
                                        onClick={() => handleApplySuggestion(qObj.question, sug)}
                                        className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer border ${
                                          isSelected
                                            ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold'
                                            : 'bg-stone-100 hover:bg-stone-200/70 text-stone-600 border-stone-200'
                                        }`}
                                      >
                                        + {sug}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* Custom Questions Section */}
                <div className="bg-white rounded-xl border border-stone-200/90 overflow-hidden shadow-2xs">
                  <div className="px-4 py-3 bg-[#FAF8F5] border-b border-stone-200/70 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-stone-100 text-stone-700">
                        <HelpCircle className="w-4 h-4" />
                      </span>
                      <div>
                        <h3 className="text-xs font-bold text-stone-900 tracking-tight">
                          Custom &amp; Additional Questions
                        </h3>
                        <p className="text-[10px] text-stone-400">
                          Lead-specific custom fields captured during discovery
                        </p>
                      </div>
                    </div>

                    {!showAddCustom && (
                      <button
                        type="button"
                        onClick={() => setShowAddCustom(true)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 hover:text-amber-950 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded-md border border-amber-200 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Question</span>
                      </button>
                    )}
                  </div>

                  <div className="p-3.5 space-y-3.5">
                    {/* Add Custom Question Input */}
                    {showAddCustom && (
                      <div className="p-3 rounded-lg bg-amber-50/50 border border-amber-200 space-y-2">
                        <label className="text-xs font-bold text-stone-800">New Custom Question / Metric</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={newCustomQuestionInput}
                            onChange={(e) => setNewCustomQuestionInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddCustomQuestion()}
                            placeholder="e.g. Return Address or Preferred ERP System: ?"
                            className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-white border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-600/30"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={handleAddCustomQuestion}
                            className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold cursor-pointer"
                          >
                            Add
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowAddCustom(false)}
                            className="px-2 py-1.5 rounded-lg text-stone-500 hover:bg-stone-200/60 text-xs font-medium cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {customQuestions.length === 0 && !showAddCustom ? (
                      <p className="text-xs text-stone-400 italic py-1">
                        No custom questions added yet. Click &quot;Add Question&quot; above to create a unique qualification field for this lead.
                      </p>
                    ) : (
                      customQuestions.map((q) => {
                        const currentVal = editingAnswers[q] || '';
                        return (
                          <div key={q} className="space-y-1.5">
                            <label className="text-xs font-bold text-stone-800 flex items-center justify-between">
                              <span>{q}</span>
                              <span className="text-[10px] text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                Custom
                              </span>
                            </label>
                            <input
                              type="text"
                              value={currentVal}
                              onChange={(e) => handleAnswerChange(q, e.target.value)}
                              placeholder="Type answer..."
                              className={`w-full px-3 py-2 text-xs rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-amber-600/30 ${
                                currentVal.trim()
                                  ? 'bg-amber-50/20 border-amber-200 font-medium text-stone-900'
                                  : 'bg-stone-50/60 border-stone-200 text-stone-700'
                              }`}
                            />
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Multi-Session Collection Timeline */}
                {selectedLead.qa_sessions && selectedLead.qa_sessions.length > 0 && (
                  <div className="bg-white rounded-xl border border-stone-200/90 p-4 space-y-3 shadow-2xs">
                    <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-700" />
                      <span>Data Collection Session Timeline ({selectedLead.qa_sessions.length})</span>
                    </h4>

                    <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                      {selectedLead.qa_sessions.map((sess, idx) => (
                        <div
                          key={sess.id || idx}
                          className="p-2.5 rounded-lg bg-[#FAF8F5] border border-stone-200/70 text-xs flex items-center justify-between flex-wrap gap-2"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-bold">
                                {sess.channel.toUpperCase()}
                              </span>
                              <span className="font-semibold text-stone-800">
                                Logged by {sess.logged_by_name || 'Agent'}
                              </span>
                            </div>
                            {sess.summary && (
                              <p className="text-[11px] text-stone-500 mt-1 italic">&quot;{sess.summary}&quot;</p>
                            )}
                          </div>
                          <span className="text-[10px] text-stone-400 font-mono">
                            {new Date(sess.timestamp).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
              <Database className="w-12 h-12 text-stone-300 mb-2" />
              <p className="text-sm font-bold text-stone-700">No Lead Selected</p>
              <p className="text-xs text-stone-400 mt-1">Select a lead from the directory to view its collected Q&amp;A sets.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
