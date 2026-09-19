import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Sparkles,
  MessageSquare,
  Mail,
  Smartphone,
  Copy,
  Check,
  ExternalLink,
  X,
  RefreshCw,
  Send,
} from 'lucide-react';
import type { Lead, OutcomeTag, FollowUpTone, FollowUpComposerResult } from '../types';
import { api } from '../lib/api';

interface SmartFollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead;
  outcomeTag?: OutcomeTag;
  callNotes?: string;
  agentName?: string;
}

export const SmartFollowUpModal: React.FC<SmartFollowUpModalProps> = ({
  isOpen,
  onClose,
  lead,
  outcomeTag = 'Interested',
  callNotes = '',
  agentName = '',
}) => {
  const [activeTab, setActiveTab] = useState<'whatsapp' | 'email' | 'sms'>('whatsapp');
  const [tone, setTone] = useState<FollowUpTone>('professional');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [whatsappText, setWhatsappText] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [smsText, setSmsText] = useState('');

  // Fetch or generate when modal opens
  useEffect(() => {
    if (isOpen) {
      handleGenerateMessages(tone);
    }
  }, [isOpen, lead.id, outcomeTag]);

  const handleGenerateMessages = async (selectedTone: FollowUpTone) => {
    setIsLoading(true);
    try {
      const res = await api.composeFollowUp({
        leadName: lead.name,
        businessInfo: lead.business_info || lead.business_notes,
        outcomeTag: (outcomeTag || 'Interested') as OutcomeTag,
        callNotes: callNotes || lead.call_logs?.[0]?.full_notes || lead.call_logs?.[0]?.summary || '',
        tone: selectedTone,
        agentName,
      });

      if (res.messages) {
        setWhatsappText(res.messages.whatsapp);
        setEmailSubject(res.messages.emailSubject);
        setEmailBody(res.messages.emailBody);
        setSmsText(res.messages.sms);
      }
    } catch (err) {
      console.error('Failed to generate smart follow-up message:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleCopy = (text: string, fieldKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const cleanPhone = lead.phone.replace(/[^0-9]/g, '');

  const openWhatsApp = () => {
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsappText)}`;
    window.open(url, '_blank');
  };

  const openMail = () => {
    const email = lead.email || '';
    const url = `mailto:${email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    window.location.href = url;
  };

  const openSms = () => {
    const url = `sms:${cleanPhone}?body=${encodeURIComponent(smsText)}`;
    window.location.href = url;
  };

  const TONES: Array<{ id: FollowUpTone; label: string; icon: string }> = [
    { id: 'professional', label: 'Professional', icon: '💼' },
    { id: 'warm_casual', label: 'Warm & Friendly', icon: '🤝' },
    { id: 'urgent_direct', label: 'Direct / Urgent', icon: '⚡' },
    { id: 'value_focused', label: 'Value & Proof', icon: '💎' },
  ];

  if (!isOpen) return null;

  return typeof document !== 'undefined'
    ? createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto"
          onClick={onClose}
        >
          <div
            className="w-full max-w-2xl my-6 bg-[#FAF8F5] border border-stone-200 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[92vh] transition-all"
            onClick={(e) => e.stopPropagation()}
          >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-700 text-amber-50 flex items-center justify-center shadow-xs">
              <Sparkles className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-stone-900">Smart Follow-Up Composer</h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-200">
                  Gemini 3.8 Flash
                </span>
              </div>
              <p className="text-xs text-stone-500">
                1-click contextual message tailored for {lead.name} ({outcomeTag})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tone Selector & Channel Tabs */}
        <div className="p-4 bg-stone-50 border-b border-stone-200 space-y-3">
          {/* Tone picker */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-600">
              <span>Tone:</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {TONES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTone(t.id);
                    handleGenerateMessages(t.id);
                  }}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    tone === t.id
                      ? 'bg-amber-700 text-white shadow-2xs'
                      : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  <span>{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Channels */}
          <div className="flex items-center justify-between border-t border-stone-200/70 pt-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('whatsapp')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'whatsapp'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-100'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('email')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'email'
                    ? 'bg-amber-700 text-white shadow-xs'
                    : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-100'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Email</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('sms')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'sms'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-100'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>SMS</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleGenerateMessages(tone)}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Regenerate</span>
            </button>
          </div>
        </div>

        {/* Message Editor Body */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center text-stone-500 gap-3">
              <Sparkles className="w-6 h-6 text-amber-600 animate-spin" />
              <p className="text-xs font-semibold">Gemini is crafting contextual follow-up messages...</p>
            </div>
          ) : (
            <>
              {/* WhatsApp Tab */}
              {activeTab === 'whatsapp' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
                      WhatsApp Message Preview
                    </label>
                    <button
                      type="button"
                      onClick={() => handleCopy(whatsappText, 'wa')}
                      className="inline-flex items-center gap-1 text-xs text-stone-600 hover:text-stone-900 cursor-pointer"
                    >
                      {copiedField === 'wa' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700 font-bold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  <textarea
                    rows={7}
                    value={whatsappText}
                    onChange={(e) => setWhatsappText(e.target.value)}
                    className="w-full p-3.5 bg-white border border-stone-300 rounded-xl text-stone-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-600 shadow-2xs font-sans leading-relaxed"
                  />

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[11px] text-stone-500">
                      Sending to {lead.phone}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopy(whatsappText, 'wa')}
                        className="px-3.5 py-2 rounded-xl border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 text-xs font-bold transition-all shadow-2xs cursor-pointer"
                      >
                        Copy Text
                      </button>
                      <button
                        type="button"
                        onClick={openWhatsApp}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Open WhatsApp</span>
                        <ExternalLink className="w-3 h-3 opacity-70" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Email Tab */}
              {activeTab === 'email' && (
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
                        Subject Line
                      </label>
                      <button
                        type="button"
                        onClick={() => handleCopy(emailSubject, 'sub')}
                        className="inline-flex items-center gap-1 text-xs text-stone-600 hover:text-stone-900 cursor-pointer"
                      >
                        {copiedField === 'sub' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700 font-bold">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      className="w-full px-3.5 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-700 shadow-2xs font-semibold"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
                        Email Body
                      </label>
                      <button
                        type="button"
                        onClick={() => handleCopy(`${emailSubject}\n\n${emailBody}`, 'emailFull')}
                        className="inline-flex items-center gap-1 text-xs text-stone-600 hover:text-stone-900 cursor-pointer"
                      >
                        {copiedField === 'emailFull' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700 font-bold">Copied All!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Full Email</span>
                          </>
                        )}
                      </button>
                    </div>
                    <textarea
                      rows={8}
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      className="w-full p-3.5 bg-white border border-stone-300 rounded-xl text-stone-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-700 shadow-2xs font-sans leading-relaxed"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[11px] text-stone-500">
                      Recipient: {lead.email || '(No email recorded on lead)'}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopy(`${emailSubject}\n\n${emailBody}`, 'emailFull')}
                        className="px-3.5 py-2 rounded-xl border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 text-xs font-bold transition-all shadow-2xs cursor-pointer"
                      >
                        Copy All
                      </button>
                      <button
                        type="button"
                        onClick={openMail}
                        disabled={!lead.email}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Open in Mail</span>
                        <ExternalLink className="w-3 h-3 opacity-70" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* SMS Tab */}
              {activeTab === 'sms' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
                      SMS Message Text ({smsText.length} chars)
                    </label>
                    <button
                      type="button"
                      onClick={() => handleCopy(smsText, 'sms')}
                      className="inline-flex items-center gap-1 text-xs text-stone-600 hover:text-stone-900 cursor-pointer"
                    >
                      {copiedField === 'sms' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700 font-bold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  <textarea
                    rows={4}
                    value={smsText}
                    onChange={(e) => setSmsText(e.target.value)}
                    className="w-full p-3.5 bg-white border border-stone-300 rounded-xl text-stone-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-600 shadow-2xs font-sans leading-relaxed"
                  />

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[11px] text-stone-500">
                      Direct SMS to {lead.phone}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopy(smsText, 'sms')}
                        className="px-3.5 py-2 rounded-xl border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 text-xs font-bold transition-all shadow-2xs cursor-pointer"
                      >
                        Copy Text
                      </button>
                      <button
                        type="button"
                        onClick={openSms}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Send SMS</span>
                        <ExternalLink className="w-3 h-3 opacity-70" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  ) : null;
};
