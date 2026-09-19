import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  FileText,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  RotateCcw,
  Sparkles,
  Search,
  BookOpen,
  HelpCircle,
  Lightbulb,
} from 'lucide-react';
import type { ObjectionBattleCard, CallScript, ObjectionCategory } from '../types';
import { api } from '../lib/api';

const CATEGORIES: Array<{ value: ObjectionCategory; label: string }> = [
  { value: 'pricing', label: 'Pricing / Budget' },
  { value: 'timing', label: 'Timing / Call Back Later' },
  { value: 'competition', label: 'Competitor / Existing Tool' },
  { value: 'gatekeeper', label: 'Gatekeeper / Assistant' },
  { value: 'authority', label: 'Decision Maker / Authority' },
  { value: 'general', label: 'General Brush-Off' },
];

export const ObjectionSettings: React.FC = () => {
  const [subTab, setSubTab] = useState<'cards' | 'scripts'>('cards');
  const [cards, setCards] = useState<ObjectionBattleCard[]>([]);
  const [scripts, setScripts] = useState<CallScript[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Card Creation / Editing State
  const [isEditingCard, setIsEditingCard] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [cardCategory, setCardCategory] = useState<ObjectionCategory>('pricing');
  const [cardObjection, setCardObjection] = useState('');
  const [cardRebuttal, setCardRebuttal] = useState('');
  const [cardTalkingPoints, setCardTalkingPoints] = useState('');
  const [cardFollowUp, setCardFollowUp] = useState('');

  // Script Creation / Editing State
  const [isEditingScript, setIsEditingScript] = useState(false);
  const [editingScriptId, setEditingScriptId] = useState<string | null>(null);
  const [scriptTitle, setScriptTitle] = useState('');
  const [scriptCategory, setScriptCategory] = useState<CallScript['category']>('cold_intro');
  const [scriptContent, setScriptContent] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [cardsRes, scriptsRes] = await Promise.all([
        api.getObjectionCards(),
        api.getCallScripts(),
      ]);
      setCards(cardsRes.cards || []);
      setScripts(scriptsRes.scripts || []);
    } catch (err: any) {
      console.error('Failed to load objection cards or scripts', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardObjection.trim() || !cardRebuttal.trim()) return;
    try {
      const points = cardTalkingPoints
        .split('\n')
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

      if (editingCardId) {
        await api.updateObjectionCard(editingCardId, {
          category: cardCategory,
          objection: cardObjection,
          rebuttal: cardRebuttal,
          talking_points: points,
          follow_up_question: cardFollowUp || undefined,
        });
        setStatusMsg('Objection battle card updated successfully.');
      } else {
        await api.createObjectionCard({
          category: cardCategory,
          objection: cardObjection,
          rebuttal: cardRebuttal,
          talking_points: points,
          follow_up_question: cardFollowUp || undefined,
        });
        setStatusMsg('New objection battle card added.');
      }
      resetCardForm();
      await fetchData();
      setTimeout(() => setStatusMsg(null), 3500);
    } catch (err: any) {
      alert(err.message || 'Failed to save battle card');
    }
  };

  const handleDeleteCard = async (id: string) => {
    if (!confirm('Are you sure you want to delete this objection battle card?')) return;
    try {
      await api.deleteObjectionCard(id);
      await fetchData();
      setStatusMsg('Battle card removed.');
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to delete battle card');
    }
  };

  const handleResetCards = async () => {
    if (!confirm('Reset all objection battle cards back to default sales battle cards?')) return;
    try {
      await api.resetDefaultObjectionCards();
      await fetchData();
      setStatusMsg('Objection battle cards reset to factory defaults.');
      setTimeout(() => setStatusMsg(null), 3500);
    } catch (err: any) {
      alert(err.message || 'Failed to reset battle cards');
    }
  };

  const startEditCard = (c: ObjectionBattleCard) => {
    setEditingCardId(c.id);
    setCardCategory(c.category);
    setCardObjection(c.objection);
    setCardRebuttal(c.rebuttal);
    setCardTalkingPoints((c.talking_points || []).join('\n'));
    setCardFollowUp(c.follow_up_question || '');
    setIsEditingCard(true);
  };

  const resetCardForm = () => {
    setIsEditingCard(false);
    setEditingCardId(null);
    setCardCategory('pricing');
    setCardObjection('');
    setCardRebuttal('');
    setCardTalkingPoints('');
    setCardFollowUp('');
  };

  // ----------------------------------------------------
  // Script Methods
  // ----------------------------------------------------
  const handleSaveScript = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scriptTitle.trim() || !scriptContent.trim()) return;
    try {
      if (editingScriptId) {
        await api.updateCallScript(editingScriptId, {
          title: scriptTitle,
          category: scriptCategory,
          content: scriptContent,
        });
        setStatusMsg('Call script updated.');
      } else {
        await api.createCallScript({
          title: scriptTitle,
          category: scriptCategory,
          content: scriptContent,
        });
        setStatusMsg('New call script created.');
      }
      resetScriptForm();
      await fetchData();
      setTimeout(() => setStatusMsg(null), 3500);
    } catch (err: any) {
      alert(err.message || 'Failed to save call script');
    }
  };

  const handleDeleteScript = async (id: string) => {
    if (!confirm('Are you sure you want to delete this script template?')) return;
    try {
      await api.deleteCallScript(id);
      await fetchData();
      setStatusMsg('Call script removed.');
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to delete script');
    }
  };

  const handleResetScripts = async () => {
    if (!confirm('Reset all call scripts back to default outreach templates?')) return;
    try {
      await api.resetDefaultCallScripts();
      await fetchData();
      setStatusMsg('Call scripts reset to factory defaults.');
      setTimeout(() => setStatusMsg(null), 3500);
    } catch (err: any) {
      alert(err.message || 'Failed to reset scripts');
    }
  };

  const startEditScript = (s: CallScript) => {
    setEditingScriptId(s.id);
    setScriptTitle(s.title);
    setScriptCategory(s.category);
    setScriptContent(s.content);
    setIsEditingScript(true);
  };

  const resetScriptForm = () => {
    setIsEditingScript(false);
    setEditingScriptId(null);
    setScriptTitle('');
    setScriptCategory('cold_intro');
    setScriptContent('');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Tab Controls */}
      <div className="p-6 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-700 text-amber-50 flex items-center justify-center shadow-xs">
              <ShieldAlert className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900">
                In-App Objection Handling &amp; Outreach Scripts
              </h3>
              <p className="text-xs text-stone-500">
                Customizable battle cards and dynamic phone scripts displayed directly inside Log Call &amp; Power Dialer.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setSubTab('cards')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  subTab === 'cards'
                    ? 'bg-white text-stone-900 shadow-2xs'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                Objection Cards ({cards.length})
              </button>
              <button
                type="button"
                onClick={() => setSubTab('scripts')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  subTab === 'scripts'
                    ? 'bg-white text-stone-900 shadow-2xs'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                Call Scripts ({scripts.length})
              </button>
            </div>
          </div>
        </div>

        {statusMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{statusMsg}</span>
          </div>
        )}
      </div>

      {/* ----------------- TAB 1: OBJECTION BATTLE CARDS ----------------- */}
      {subTab === 'cards' && (
        <div className="space-y-5">
          {/* Action Header */}
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search objections, rebuttals, or talking points..."
                className="w-full pl-8 pr-3 py-2 bg-white border border-stone-200 rounded-xl text-xs text-stone-800 focus:ring-2 focus:ring-amber-700"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetCards}
                className="px-3 py-2 text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                title="Restore default battle cards"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reset Defaults</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  resetCardForm();
                  setIsEditingCard(true);
                }}
                className="px-3.5 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Battle Card</span>
              </button>
            </div>
          </div>

          {/* Form Modal / Inline Editor */}
          {isEditingCard && (
            <div className="p-5 bg-white border-2 border-amber-500/40 rounded-2xl shadow-sm space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                <h4 className="text-sm font-bold text-stone-900">
                  {editingCardId ? 'Edit Battle Card' : 'Create New Objection Counter'}
                </h4>
                <button
                  type="button"
                  onClick={resetCardForm}
                  className="p-1 rounded-lg text-stone-400 hover:text-stone-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveCard} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Objection Category <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={cardCategory}
                      onChange={(e) => setCardCategory(e.target.value as ObjectionCategory)}
                      className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs bg-white text-stone-800 focus:ring-2 focus:ring-amber-700"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Prospect Objection Trigger <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={cardObjection}
                      onChange={(e) => setCardObjection(e.target.value)}
                      placeholder='e.g. "We don’t have budget until next year"'
                      className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs bg-white text-stone-800 focus:ring-2 focus:ring-amber-700"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Primary Recommended Rebuttal <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={cardRebuttal}
                    onChange={(e) => setCardRebuttal(e.target.value)}
                    placeholder="Word-for-word response for the rep to deliver with conviction..."
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs bg-white text-stone-800 focus:ring-2 focus:ring-amber-700"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Strategic Talking Points (1 per line)
                    </label>
                    <textarea
                      rows={3}
                      value={cardTalkingPoints}
                      onChange={(e) => setCardTalkingPoints(e.target.value)}
                      placeholder="Point 1: Acknowledge and validate&#10;Point 2: Reframe budget as investment"
                      className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs bg-white text-stone-800 focus:ring-2 focus:ring-amber-700"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Follow-Up Diagnostic Question
                    </label>
                    <textarea
                      rows={3}
                      value={cardFollowUp}
                      onChange={(e) => setCardFollowUp(e.target.value)}
                      placeholder='e.g. "If budget wasn’t a factor, would this solve your core problem?"'
                      className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs bg-white text-stone-800 focus:ring-2 focus:ring-amber-700"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={resetCardForm}
                    className="px-3.5 py-1.5 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-100 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold shadow-xs cursor-pointer"
                  >
                    {editingCardId ? 'Save Changes' : 'Create Battle Card'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Cards Grid */}
          <div className="grid grid-cols-1 gap-3">
            {cards
              .filter((c) => {
                if (!searchQuery) return true;
                const q = searchQuery.toLowerCase();
                return (
                  c.objection.toLowerCase().includes(q) ||
                  c.rebuttal.toLowerCase().includes(q) ||
                  c.category.toLowerCase().includes(q)
                );
              })
              .map((c) => (
                <div
                  key={c.id}
                  className="p-4 bg-white border border-stone-200 rounded-xl shadow-2xs space-y-2 hover:border-amber-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-stone-100 text-stone-700 border border-stone-200">
                          {c.category}
                        </span>
                        {c.is_custom && (
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-900 border border-amber-200">
                            Custom
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-stone-900">&ldquo;{c.objection}&rdquo;</h4>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEditCard(c)}
                        className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-100 cursor-pointer"
                        title="Edit battle card"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCard(c.id)}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                        title="Delete battle card"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-stone-700 bg-amber-50/40 p-2.5 rounded-lg border border-amber-100 font-medium">
                    &ldquo;{c.rebuttal}&rdquo;
                  </p>

                  {c.follow_up_question && (
                    <div className="text-[11px] text-teal-800 italic pl-1 flex items-center gap-1">
                      <HelpCircle className="w-3 h-3 text-teal-600 shrink-0" />
                      <span>{c.follow_up_question}</span>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ----------------- TAB 2: CALL SCRIPTS ----------------- */}
      {subTab === 'scripts' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-stone-500">
              Interactive script templates supporting variable tags: <code className="text-amber-800 font-bold font-mono">{"{{name}}"}</code>, <code className="text-amber-800 font-bold font-mono">{"{{company}}"}</code>, and <code className="text-amber-800 font-bold font-mono">{"{{notes}}"}</code>.
            </p>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleResetScripts}
                className="px-3 py-2 text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reset Defaults</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  resetScriptForm();
                  setIsEditingScript(true);
                }}
                className="px-3.5 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Script</span>
              </button>
            </div>
          </div>

          {/* Script Editor Form */}
          {isEditingScript && (
            <div className="p-5 bg-white border-2 border-amber-500/40 rounded-2xl shadow-sm space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                <h4 className="text-sm font-bold text-stone-900">
                  {editingScriptId ? 'Edit Call Script' : 'Create New Script Template'}
                </h4>
                <button
                  type="button"
                  onClick={resetScriptForm}
                  className="p-1 rounded-lg text-stone-400 hover:text-stone-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveScript} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Script Title <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={scriptTitle}
                      onChange={(e) => setScriptTitle(e.target.value)}
                      placeholder="e.g. 30-Second Cold Hook"
                      className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs bg-white text-stone-800 focus:ring-2 focus:ring-amber-700"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Stage / Category
                    </label>
                    <select
                      value={scriptCategory}
                      onChange={(e) => setScriptCategory(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs bg-white text-stone-800 focus:ring-2 focus:ring-amber-700"
                    >
                      <option value="cold_intro">Cold Introduction</option>
                      <option value="discovery">Discovery &amp; Qualification</option>
                      <option value="gatekeeper">Gatekeeper Bridge</option>
                      <option value="voicemail">Voicemail Drop</option>
                      <option value="closing">Demo Closing</option>
                      <option value="custom">Custom Stage</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Script Content (Variables: {'{{name}}'}, {'{{company}}'}, {'{{notes}}'})
                  </label>
                  <textarea
                    rows={5}
                    required
                    value={scriptContent}
                    onChange={(e) => setScriptContent(e.target.value)}
                    placeholder="Hi {{name}}, I was looking into {{company}}..."
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs bg-white text-stone-800 focus:ring-2 focus:ring-amber-700 font-sans"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={resetScriptForm}
                    className="px-3.5 py-1.5 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-100 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold shadow-xs cursor-pointer"
                  >
                    {editingScriptId ? 'Save Script' : 'Create Script'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Scripts List */}
          <div className="space-y-3">
            {scripts.map((s) => (
              <div
                key={s.id}
                className="p-4 bg-white border border-stone-200 rounded-xl shadow-2xs space-y-2 hover:border-amber-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-teal-50 text-teal-800 border border-teal-200">
                      {s.category.replace('_', ' ')}
                    </span>
                    <h4 className="text-sm font-bold text-stone-900 mt-1">{s.title}</h4>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => startEditScript(s)}
                      className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-100 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteScript(s.id)}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-700 whitespace-pre-wrap font-sans">
                  {s.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
