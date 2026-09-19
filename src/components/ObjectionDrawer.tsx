import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  FileText,
  Search,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Sparkles,
  HelpCircle,
  Lightbulb,
  MessageSquare,
  BookOpen,
  Filter,
} from 'lucide-react';
import type { ObjectionBattleCard, CallScript, ObjectionCategory, Lead } from '../types';
import { api } from '../lib/api';

interface ObjectionDrawerProps {
  lead?: Partial<Lead> | null;
  onSelectRebuttal?: (rebuttalText: string) => void;
  className?: string;
}

const CATEGORY_LABELS: Record<ObjectionCategory | 'all', string> = {
  all: 'All Objections',
  pricing: 'Pricing / Budget',
  timing: 'Bad Timing',
  competition: 'Competitor',
  gatekeeper: 'Gatekeeper',
  authority: 'Authority',
  general: 'General Brush-off',
};

export const ObjectionDrawer: React.FC<ObjectionDrawerProps> = ({
  lead,
  onSelectRebuttal,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState<'objections' | 'scripts'>('objections');
  const [cards, setCards] = useState<ObjectionBattleCard[]>([]);
  const [scripts, setScripts] = useState<CallScript[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ObjectionCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [cardsRes, scriptsRes] = await Promise.all([
        api.getObjectionCards(),
        api.getCallScripts(),
      ]);
      setCards(cardsRes.cards || []);
      setScripts(scriptsRes.scripts || []);
      if (cardsRes.cards && cardsRes.cards.length > 0) {
        setExpandedCardId(cardsRes.cards[0].id);
      }
    } catch (err) {
      console.error('Failed to load objection cards or scripts', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Interpolate script template variables
  const formatScriptContent = (template: string): string => {
    let result = template;
    const leadName = lead?.name?.trim() || '[Prospect Name]';
    const company = lead?.business_info?.trim() || lead?.business_notes?.slice(0, 30)?.trim() || '[Company]';
    const notes = lead?.business_notes?.trim() || '[Context]';

    result = result.replace(/\{\{name\}\}/gi, leadName);
    result = result.replace(/\{\{company\}\}/gi, company);
    result = result.replace(/\{\{notes\}\}/gi, notes);
    return result;
  };

  const filteredCards = cards.filter((c) => {
    const matchesCategory = selectedCategory === 'all' || c.category === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      c.objection.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.rebuttal.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.talking_points && c.talking_points.some((p) => p.toLowerCase().includes(searchQuery.toLowerCase())));
    return matchesCategory && matchesSearch;
  });

  const filteredScripts = scripts.filter((s) => {
    if (!searchQuery) return true;
    return (
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.content.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className={`bg-stone-50 border border-stone-200 rounded-2xl flex flex-col overflow-hidden text-stone-800 ${className}`}>
      {/* Top Header & Tab Switcher */}
      <div className="p-3 sm:p-4 bg-white border-b border-stone-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab('objections')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'objections'
                ? 'bg-white text-stone-900 shadow-2xs'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
            <span>Objection Rebuttals ({cards.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('scripts')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'scripts'
                ? 'bg-white text-stone-900 shadow-2xs'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-teal-700" />
            <span>Call Scripts ({scripts.length})</span>
          </button>
        </div>
      </div>

      {/* Search and Category Filter Bar */}
      <div className="p-3 bg-stone-100/70 border-b border-stone-200 space-y-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === 'objections'
                ? 'Search objection counters (e.g. price, competitor, email)...'
                : 'Search call script talking points...'
            }
            className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-stone-200 bg-white text-xs text-stone-800 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-amber-700"
          />
        </div>

        {activeTab === 'objections' && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            {(['all', 'pricing', 'timing', 'competition', 'gatekeeper', 'authority'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-amber-700 text-white shadow-2xs'
                    : 'bg-white text-stone-600 hover:bg-stone-200/80 border border-stone-200'
                }`}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Body List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 max-h-96 sm:max-h-[28rem]">
        {isLoading && (
          <div className="p-6 text-center text-xs text-stone-500 animate-pulse">
            Loading battle cards &amp; scripts...
          </div>
        )}

        {!isLoading && activeTab === 'objections' && filteredCards.length === 0 && (
          <div className="p-6 text-center text-xs text-stone-500 bg-white rounded-xl border border-dashed border-stone-200">
            No matching objection battle cards found for this query.
          </div>
        )}

        {!isLoading && activeTab === 'scripts' && filteredScripts.length === 0 && (
          <div className="p-6 text-center text-xs text-stone-500 bg-white rounded-xl border border-dashed border-stone-200">
            No matching scripts found.
          </div>
        )}

        {/* Objection Battle Cards */}
        {activeTab === 'objections' &&
          filteredCards.map((card) => {
            const isExpanded = expandedCardId === card.id;
            return (
              <div
                key={card.id}
                className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-2xs transition-all"
              >
                {/* Accordion Bar */}
                <button
                  type="button"
                  onClick={() => setExpandedCardId(isExpanded ? null : card.id)}
                  className="w-full p-3 text-left flex items-start justify-between gap-3 hover:bg-stone-50 transition-colors cursor-pointer"
                >
                  <div className="space-y-0.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-stone-100 text-stone-600 border border-stone-200">
                        {card.category}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-stone-900 mt-1">
                      &ldquo;{card.objection}&rdquo;
                    </h4>
                  </div>
                  <div className="text-stone-400 shrink-0 mt-1">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="p-3 pt-0 border-t border-stone-100 bg-amber-50/20 space-y-3">
                    {/* Primary Rebuttal Box */}
                    <div className="p-3 rounded-xl bg-amber-100/50 border border-amber-200/80 space-y-1.5 mt-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                          Recommended Rebuttal
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCopy(card.rebuttal, card.id)}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white hover:bg-stone-100 text-stone-600 border border-stone-200 text-[10px] font-semibold cursor-pointer"
                            title="Copy rebuttal"
                          >
                            {copiedId === card.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span className="text-emerald-700">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                          {onSelectRebuttal && (
                            <button
                              type="button"
                              onClick={() => onSelectRebuttal(card.rebuttal)}
                              className="px-2 py-0.5 rounded-md bg-amber-700 hover:bg-amber-800 text-white text-[10px] font-bold cursor-pointer"
                            >
                              Insert in Notes
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-stone-800 leading-relaxed font-medium">
                        &ldquo;{card.rebuttal}&rdquo;
                      </p>
                    </div>

                    {/* Key Strategic Talking Points */}
                    {card.talking_points && card.talking_points.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-[10px] uppercase font-bold text-stone-500 tracking-wider flex items-center gap-1">
                          <Lightbulb className="w-3 h-3 text-amber-600" />
                          Strategic Angle &amp; Psychology
                        </div>
                        <ul className="space-y-1 pl-1">
                          {card.talking_points.map((point, idx) => (
                            <li key={idx} className="text-[11px] text-stone-600 flex items-start gap-1.5">
                              <span className="text-amber-700 font-bold">•</span>
                              <span>{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Bridge Follow-up Question */}
                    {card.follow_up_question && (
                      <div className="p-2.5 rounded-lg bg-white border border-stone-200 space-y-0.5">
                        <div className="text-[10px] uppercase font-bold text-teal-800 tracking-wider flex items-center gap-1">
                          <HelpCircle className="w-3 h-3 text-teal-600" />
                          Recommended Turn-Around Question
                        </div>
                        <p className="text-xs text-stone-700 font-medium italic">
                          &ldquo;{card.follow_up_question}&rdquo;
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

        {/* Call Scripts */}
        {activeTab === 'scripts' &&
          filteredScripts.map((script) => {
            const formatted = formatScriptContent(script.content);
            return (
              <div
                key={script.id}
                className="p-3.5 bg-white border border-stone-200 rounded-xl shadow-2xs space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-teal-50 text-teal-800 border border-teal-200">
                      {script.category.replace('_', ' ')}
                    </span>
                    <h4 className="text-xs font-bold text-stone-900 mt-1">{script.title}</h4>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopy(formatted, script.id)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-[10px] font-semibold cursor-pointer"
                      title="Copy script"
                    >
                      {copiedId === script.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-700">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                    {onSelectRebuttal && (
                      <button
                        type="button"
                        onClick={() => onSelectRebuttal(formatted)}
                        className="px-2 py-1 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-[10px] font-bold cursor-pointer"
                      >
                        Insert
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-stone-50 border border-stone-200 text-xs text-stone-800 whitespace-pre-wrap leading-relaxed font-sans">
                  {formatted}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
};
