import React, { useState, useRef, useEffect } from 'react';
import {
  Phone,
  PhoneCall,
  Clock,
  ChevronDown,
  ChevronUp,
  Plus,
  Flame,
  Calendar,
  Building,
  History,
  FileText,
  Tag,
  ExternalLink,
  ArrowRightLeft,
  Pin,
  User as UserIcon,
  MessageSquareText,
  Handshake,
  MessageCircle,
  MoreVertical,
  Check,
  Copy,
  UserPlus,
  ClipboardList,
} from 'lucide-react';
import type { Lead, OutcomeTag, PinnedComment, User } from '../types';
import { isDueNowOrOverdue, formatFriendlyTime } from '../lib/dateUtils';
import { ContactActionMenu } from './ContactActionMenu';
import { PinnedCommentBadge } from './PinnedCommentBadge';
import { LeadHealthBadge } from './LeadHealthBadge';
import { SmartFollowUpModal } from './SmartFollowUpModal';
import { QuickPostponeModal } from './QuickPostponeModal';
import { api } from '../lib/api';
import { formatPhoneForDialer, getWhatsAppUrl, saveLeadToContacts } from '../lib/contactUtils';
import { formatPhoneDisplay } from '../lib/countries';

function getLeadMessageDisplay(lead: Lead) {
  const isCleanShortLabel = (str?: string | null) =>
    Boolean(str && str.length <= 30 && !str.includes('\n') && !str.includes(': ?') && !str.includes('Location / Address'));

  // 1. Check if there are recent inbound WhatsApp messages in call_logs
  const inboundCallLog = lead.call_logs?.find(
    (l) =>
      l.summary?.toLowerCase().includes('whatsapp') ||
      l.full_notes?.toLowerCase().includes('inbound whatsapp')
  );

  if (inboundCallLog) {
    const raw = inboundCallLog.full_notes || inboundCallLog.summary || '';
    const match = raw.match(/\[Inbound WhatsApp\]:\s*"?([^"\n\r]+)/i) || raw.match(/"([^"]+)"/);
    const text = match ? match[1].trim() : raw.replace(/\[Inbound WhatsApp\]:?\s*/i, '').trim();
    return {
      isWhatsApp: true,
      text,
      time: inboundCallLog.timestamp,
      label: isCleanShortLabel(lead.business_info) ? lead.business_info : 'Inbound Message',
    };
  }

  // 2. Check if lead itself came from WhatsApp Inbound
  const isWhatsAppSource =
    lead.source === 'WhatsApp Inbound' ||
    lead.business_notes?.includes('[Initial Inbound WhatsApp Message]');

  if (isWhatsAppSource && lead.business_notes) {
    const match =
      lead.business_notes.match(/\[Initial Inbound WhatsApp Message\]:\s*"?([\s\S]*?)(?:"|$)/i) ||
      lead.business_notes.match(/Inbound WhatsApp Inquiry:\s*"?([\s\S]*?)(?:"|$)/i) ||
      lead.business_notes.match(/"([^"]{3,200})"/);

    let text = match ? match[1].trim() : '';
    if (!text) {
      text = lead.business_notes
        .split('\n')[0]
        .replace(/^(Thought-out detailed inquiry received|Inbound business inquiry detected|Inquiry received):\s*"?/i, '')
        .replace(/"$/, '')
        .trim();
    }

    return {
      isWhatsApp: true,
      text,
      time: lead.created_at,
      label: isCleanShortLabel(lead.business_info) ? lead.business_info : 'Inbound Inquiry',
    };
  }

  // 3. Regular business notes
  return {
    isWhatsApp: false,
    text: lead.business_notes || '',
    time: null,
    label: null,
  };
}

interface LeadCardProps {
  lead: Lead;
  onLogCall: (lead: Lead) => void;
  onOpenDetail: (lead: Lead) => void;
  onTogglePriority: (lead: Lead) => void;
  onPostpone?: (lead: Lead, newDatetimeIso?: string) => void;
  onReassign?: (lead: Lead) => void;
  onRequestAssistance?: (lead: Lead) => void;
  pinnedComments?: PinnedComment[];
  onPinDirective?: (lead: Lead) => void;
  onPinCallLog?: (lead: Lead, callLogId: string, snippet: string) => void;
  currentUser?: User | null;
  onCommentStatusUpdated?: (commentId: string, newStatus: 'acknowledged' | 'done') => void;
  onOpenQA?: (lead: Lead) => void;
}

export const LeadCard: React.FC<LeadCardProps> = ({
  lead,
  onLogCall,
  onOpenDetail,
  onTogglePriority,
  onPostpone,
  onReassign,
  onRequestAssistance,
  pinnedComments = [],
  onPinDirective,
  onPinCallLog,
  currentUser,
  onCommentStatusUpdated,
  onOpenQA,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFollowUpOpen, setIsFollowUpOpen] = useState(false);
  const [isPostponeModalOpen, setIsPostponeModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [savedContact, setSavedContact] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [mobileMenuOpen]);

  // Swipe gesture state
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    isHorizontalSwipeRef.current = null;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const deltaX = e.touches[0].clientX - touchStartXRef.current;
    const deltaY = e.touches[0].clientY - touchStartYRef.current;

    if (isHorizontalSwipeRef.current === null) {
      if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
        isHorizontalSwipeRef.current = Math.abs(deltaX) > Math.abs(deltaY);
      }
    }

    if (isHorizontalSwipeRef.current) {
      // Clamped swipe distance for elastic feel
      const clamped = Math.max(-135, Math.min(135, deltaX));
      setSwipeOffset(clamped);
    }
  };

  const handleTouchEnd = () => {
    if (touchStartXRef.current !== null && isHorizontalSwipeRef.current) {
      const SWIPE_THRESHOLD = 70;
      if (swipeOffset < -SWIPE_THRESHOLD) {
        // Swiped LEFT -> Trigger Log Call
        if (typeof window !== 'undefined' && window.navigator?.vibrate) {
          try { window.navigator.vibrate(35); } catch {}
        }
        onLogCall(lead);
      } else if (swipeOffset > SWIPE_THRESHOLD) {
        // Swiped RIGHT -> Trigger Postpone / Reschedule
        if (typeof window !== 'undefined' && window.navigator?.vibrate) {
          try { window.navigator.vibrate(35); } catch {}
        }
        setIsPostponeModalOpen(true);
      }
    }

    setIsSwiping(false);
    setSwipeOffset(0);
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    isHorizontalSwipeRef.current = null;
  };

  const handlePostponeSave = async (leadId: string, newDatetimeIso: string) => {
    if (onPostpone) {
      onPostpone(lead, newDatetimeIso);
    } else {
      await api.updateLead(leadId, {
        next_action_at: newDatetimeIso,
        status: 'Follow-up Scheduled',
      });
    }
  };

  const isOverdue = isDueNowOrOverdue(lead.next_action_at);
  const isHighPriority = lead.priority === 'High';

  const lastCall = lead.call_logs && lead.call_logs.length > 0 ? lead.call_logs[0] : null;

  // Filter pinned comments specifically for this lead
  const leadPinnedComments = pinnedComments.filter((c) => c.lead_id === lead.id);

  // Outcome tag color maps
  const getOutcomeTagBadge = (tag: OutcomeTag | undefined) => {
    if (!tag) return null;
    let colorClasses = 'bg-stone-100 text-stone-700 border-stone-200';
    if (tag === 'Interested') colorClasses = 'bg-emerald-50 text-emerald-800 border-emerald-200';
    if (tag === 'Call Back Later') colorClasses = 'bg-amber-50 text-amber-800 border-amber-200';
    if (tag === 'Closed/Matured') colorClasses = 'bg-teal-50 text-teal-800 border-teal-200';
    if (tag === 'Service Denied') colorClasses = 'bg-rose-50 text-rose-800 border-rose-200';
    if (tag === 'Busy' || tag === "Couldn't Connect") colorClasses = 'bg-stone-100 text-stone-600 border-stone-200';

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${colorClasses}`}>
        {tag}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    let classes = 'bg-stone-100 text-stone-700 border-stone-200';
    if (status === 'Active') classes = 'bg-sky-50 text-sky-800 border-sky-200';
    if (status === 'Follow-up Scheduled') classes = 'bg-amber-50 text-amber-900 border-amber-200 font-medium';
    if (status === 'Matured (Closed)') classes = 'bg-teal-50 text-teal-800 border-teal-200';
    if (status === 'Service Denied') classes = 'bg-rose-50 text-rose-800 border-rose-200';
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${classes}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="relative overflow-hidden rounded-xl touch-pan-y group">
      {/* Background Swipe Actions Layer */}
      {/* Right-swipe reveal (Left side): Postpone / Reschedule */}
      <div
        className={`absolute inset-y-0 left-0 w-full bg-gradient-to-r from-sky-600 via-sky-600 to-sky-700 text-white flex items-center justify-start pl-6 gap-2.5 font-bold text-xs transition-opacity duration-150 rounded-xl ${
          swipeOffset > 8 ? 'opacity-100 z-0' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div
          className={`flex items-center gap-2 transition-transform duration-150 ${
            swipeOffset >= 70 ? 'scale-110 text-white' : 'scale-95 text-sky-100'
          }`}
        >
          <Calendar className="w-5 h-5 shrink-0" />
          <span className="tracking-wide">
            {swipeOffset >= 70 ? 'Release to Reschedule' : 'Swipe to Postpone'}
          </span>
        </div>
      </div>

      {/* Left-swipe reveal (Right side): Log Call */}
      <div
        className={`absolute inset-y-0 right-0 w-full bg-gradient-to-l from-emerald-600 via-emerald-600 to-emerald-700 text-white flex items-center justify-end pr-6 gap-2.5 font-bold text-xs transition-opacity duration-150 rounded-xl ${
          swipeOffset < -8 ? 'opacity-100 z-0' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div
          className={`flex items-center gap-2 transition-transform duration-150 ${
            swipeOffset <= -70 ? 'scale-110 text-white' : 'scale-95 text-emerald-100'
          }`}
        >
          <span className="tracking-wide">
            {swipeOffset <= -70 ? 'Release to Log Call' : 'Swipe to Log Call'}
          </span>
          <PhoneCall className="w-5 h-5 shrink-0" />
        </div>
      </div>

      {/* Foreground Swipeable Card */}
      <div
        id={`lead-card-${lead.id}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: isSwiping ? 'none' : 'transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1)',
        }}
        className={`relative z-10 bg-white rounded-xl border transition-colors duration-150 ${
          isOverdue
            ? 'border-amber-400/90 shadow-sm ring-1 ring-amber-400/30'
            : isHighPriority
            ? 'border-amber-300/80 shadow-2xs'
            : 'border-stone-200/90 hover:border-stone-300 shadow-2xs'
        }`}
      >
      {/* Visual Anchor for attached physical sticky note */}
      <div
        id={`lead-sticky-anchor-${lead.id}`}
        className="absolute top-2.5 right-4 sm:right-6 pointer-events-none w-1 h-1"
      />

      {/* High Priority or Due Banner ribbon */}
      {isOverdue && (
        <div className="bg-amber-500 text-amber-950 font-bold text-[10px] uppercase tracking-wider px-3 py-0.5 rounded-t-[11px] flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>Follow-up Due Now</span>
          </span>
          <span className="font-mono text-[10px] font-semibold">{formatFriendlyTime(lead.next_action_at)}</span>
        </div>
      )}

      <div className="p-4 sm:p-5">
        {/* Top row: Name, Phone & Status Badge */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => onOpenDetail(lead)}
              className="text-left font-bold text-stone-900 text-base hover:text-amber-800 transition-colors cursor-pointer group flex items-center gap-1.5"
            >
              <span>{lead.name}</span>
              <ExternalLink className="w-3.5 h-3.5 text-stone-400 group-hover:text-amber-700 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>

            {/* High priority toggle pill */}
            <button
              onClick={() => onTogglePriority(lead)}
              title={isHighPriority ? 'High priority lead (click to toggle)' : 'Normal priority (click to mark High)'}
              className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold border flex items-center gap-0.5 transition-colors cursor-pointer ${
                isHighPriority
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-stone-50 text-stone-400 border-stone-200 hover:text-stone-700'
              }`}
            >
              <Flame className={`w-3 h-3 ${isHighPriority ? 'text-amber-600 fill-amber-600' : 'text-stone-400'}`} />
              <span>{isHighPriority ? 'High' : 'Normal'}</span>
            </button>

            {getStatusBadge(lead.status)}
            <LeadHealthBadge lead={lead} size="sm" />
            {lastCall && getOutcomeTagBadge(lastCall.outcome_tag)}

            {lead.assigned_to_name && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-stone-100 text-stone-700 border border-stone-200">
                <UserIcon className="w-3 h-3 text-stone-400" />
                <span>{lead.assigned_to_name}</span>
              </span>
            )}

            {leadPinnedComments.length > 0 && (
              <PinnedCommentBadge
                comments={leadPinnedComments}
                currentUser={currentUser}
                onStatusUpdated={onCommentStatusUpdated}
              />
            )}
          </div>

          {/* Desktop Quick Call & Contact Actions */}
          <div className="hidden sm:flex items-center gap-2">
            <ContactActionMenu
              contact={{
                name: lead.name,
                phone: lead.phone,
                business_notes: lead.business_notes,
                business_info: lead.business_info,
                source: lead.source,
              }}
            />

            {/* Reassign action button for Managers / Admins */}
            {onReassign && (
              <button
                type="button"
                onClick={() => onReassign(lead)}
                title="Reassign lead to another team member or yourself"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-amber-100 text-stone-700 hover:text-amber-900 border border-stone-200 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-amber-700" />
                <span>Reassign</span>
              </button>
            )}

            {/* Request Colleague Assistance button */}
            {onRequestAssistance && (
              <button
                type="button"
                onClick={() => onRequestAssistance(lead)}
                title="Request a colleague to take over this lead"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50/70 hover:bg-amber-100 text-amber-900 border border-amber-300/80 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                <Handshake className="w-3.5 h-3.5 text-amber-700" />
                <span className="hidden md:inline">Ask Takeover</span>
              </button>
            )}

            {/* Pin directive action for Managers / Admins */}
            {onPinDirective && (
              <button
                type="button"
                onClick={() => onPinDirective(lead)}
                title="Pin manager directive to this lead"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300/80 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                <Pin className="w-3.5 h-3.5 fill-amber-700 text-amber-700" />
                <span>+ Pin</span>
              </button>
            )}

            {/* Smart follow-up 1-click generator */}
            <button
              type="button"
              onClick={() => setIsFollowUpOpen(true)}
              title="Smart Follow-Up Composer (WhatsApp / Email / SMS)"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300/80 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              <MessageSquareText className="w-3.5 h-3.5 text-amber-700" />
              <span className="hidden sm:inline">Follow-Up</span>
            </button>

            <button
              id={`log-call-btn-${lead.id}`}
              onClick={() => onLogCall(lead)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Call</span>
            </button>
          </div>
        </div>

        {/* Business notes or WhatsApp message snippet */}
        {(() => {
          const msg = getLeadMessageDisplay(lead);
          if (!msg.text) return null;
          return (
            <div className="text-xs mb-3 bg-[#FBF9F5] p-2.5 rounded-lg border border-stone-200/60">
              {msg.isWhatsApp ? (
                <div>
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-semibold">
                      <MessageCircle className="w-2.5 h-2.5 fill-emerald-600/30" />
                      <span>{msg.label || 'WhatsApp Inbound'}</span>
                    </span>
                    {msg.time && (
                      <span className="text-[10px] text-stone-400 font-mono">
                        {formatFriendlyTime(msg.time)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-800 line-clamp-2 italic font-sans">
                    "{msg.text}"
                  </p>
                </div>
              ) : (
                <div className="line-clamp-2 text-stone-600">
                  <span className="font-semibold text-stone-700 mr-1">Business:</span>
                  {msg.text}
                </div>
              )}
            </div>
          );
        })()}

        {/* Mobile Consolidated Action Toolbar */}
        <div className="flex sm:hidden items-center justify-between gap-1.5 pb-2.5 mb-2.5 border-b border-stone-100">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {/* Tap to Call */}
            <a
              href={`tel:${formatPhoneForDialer(lead.phone)}`}
              className="inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold border border-stone-200 transition-colors shrink-0"
              title="Tap to call"
            >
              <Phone className="w-3.5 h-3.5 text-amber-700" />
              <span className="font-mono text-[11px] truncate max-w-[100px]">{formatPhoneDisplay(lead.phone)}</span>
            </a>

            {/* WhatsApp */}
            <a
              href={getWhatsAppUrl(lead.phone)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs transition-colors shrink-0 cursor-pointer"
              title="Chat on WhatsApp"
            >
              <MessageCircle className="w-3.5 h-3.5 fill-white/20" />
              <span>WhatsApp</span>
            </a>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Log Call */}
            <button
              onClick={() => onLogCall(lead)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
              title="Log call outcome"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Call</span>
            </button>

            {/* More actions menu button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 border border-stone-200 transition-colors cursor-pointer"
                title="More actions"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {mobileMenuOpen && (
                <div
                  ref={menuRef}
                  className="absolute right-0 bottom-full mb-1.5 w-48 bg-white border border-stone-200 rounded-xl shadow-xl z-30 py-1 text-xs animate-in fade-in slide-in-from-bottom-2 duration-150"
                >
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(lead.phone);
                      setCopiedPhone(true);
                      setTimeout(() => {
                        setCopiedPhone(false);
                        setMobileMenuOpen(false);
                      }, 1500);
                    }}
                    className="w-full text-left px-3 py-2 text-stone-700 hover:bg-stone-50 flex items-center gap-2 cursor-pointer"
                  >
                    {copiedPhone ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-stone-400" />}
                    <span>{copiedPhone ? 'Phone Copied!' : 'Copy Phone'}</span>
                  </button>

                  <button
                    onClick={async () => {
                      await saveLeadToContacts({
                        name: lead.name,
                        phone: lead.phone,
                        business_notes: lead.business_notes,
                        business_info: lead.business_info,
                        source: lead.source,
                      });
                      setSavedContact(true);
                      setTimeout(() => {
                        setSavedContact(false);
                        setMobileMenuOpen(false);
                      }, 1500);
                    }}
                    className="w-full text-left px-3 py-2 text-stone-700 hover:bg-stone-50 flex items-center gap-2 cursor-pointer"
                  >
                    {savedContact ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <UserPlus className="w-3.5 h-3.5 text-stone-400" />}
                    <span>{savedContact ? 'Saved to Contacts!' : 'Add to Contacts'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setIsFollowUpOpen(true);
                    }}
                    className="w-full text-left px-3 py-2 text-stone-700 hover:bg-stone-50 flex items-center gap-2 cursor-pointer"
                  >
                    <MessageSquareText className="w-3.5 h-3.5 text-amber-700" />
                    <span>Smart Follow-Up (AI)</span>
                  </button>

                  {onRequestAssistance && (
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onRequestAssistance(lead);
                      }}
                      className="w-full text-left px-3 py-2 text-stone-700 hover:bg-stone-50 flex items-center gap-2 cursor-pointer"
                    >
                      <Handshake className="w-3.5 h-3.5 text-amber-700" />
                      <span>Ask Colleague Takeover</span>
                    </button>
                  )}

                  {onReassign && (
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onReassign(lead);
                      }}
                      className="w-full text-left px-3 py-2 text-stone-700 hover:bg-stone-50 flex items-center gap-2 cursor-pointer"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5 text-amber-700" />
                      <span>Reassign Lead</span>
                    </button>
                  )}

                  {onPinDirective && (
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onPinDirective(lead);
                      }}
                      className="w-full text-left px-3 py-2 text-stone-700 hover:bg-stone-50 flex items-center gap-2 cursor-pointer"
                    >
                      <Pin className="w-3.5 h-3.5 text-amber-700" />
                      <span>Pin Directive</span>
                    </button>
                  )}

                  {onOpenQA && (
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onOpenQA(lead);
                      }}
                      className="w-full text-left px-3 py-2 text-amber-900 bg-amber-50/50 hover:bg-amber-100/60 flex items-center gap-2 cursor-pointer font-medium"
                    >
                      <ClipboardList className="w-3.5 h-3.5 text-amber-700" />
                      <span>Lead Q&amp;A Sets</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Next action scheduled & Snippet of last call */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100 text-xs text-stone-500">
          <div className="flex items-center gap-2">
            {lead.next_action_at ? (
              <span
                className={`inline-flex items-center gap-1.5 font-medium ${
                  isOverdue ? 'text-amber-900 font-bold' : 'text-stone-700'
                }`}
              >
                <Calendar className={`w-3.5 h-3.5 ${isOverdue ? 'text-amber-600' : 'text-stone-400'}`} />
                <span>Next Follow-up:</span>
                <span className="font-semibold">{formatFriendlyTime(lead.next_action_at)}</span>
              </span>
            ) : (
              <span className="text-stone-400 italic">No follow-up scheduled</span>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
            <span className="text-[11px] text-stone-400 hidden xs:inline">
              {lead.call_logs.length} call{lead.call_logs.length === 1 ? '' : 's'} logged
            </span>

            {/* QA Sets Pop-up Button: Second option next to View History */}
            {onOpenQA && (
              <button
                id={`btn-open-qa-${lead.id}`}
                type="button"
                onClick={() => onOpenQA(lead)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 hover:text-amber-950 bg-amber-50 hover:bg-amber-100/80 px-2 py-1 rounded-md border border-amber-200/90 transition-colors cursor-pointer shadow-2xs"
                title="Open Lead Qualification Q&A Sets Pop-up Window"
              >
                <ClipboardList className="w-3.5 h-3.5 text-amber-700" />
                <span>Lead Q&amp;A</span>
                {lead.qa_data && Object.keys(lead.qa_data).length > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600" title="Has answered QA data"></span>
                )}
              </button>
            )}

            <button
              id={`toggle-expand-${lead.id}`}
              onClick={() => setIsExpanded(!isExpanded)}
              className="inline-flex items-center gap-1 text-xs font-medium text-stone-600 hover:text-stone-900 p-1 rounded-md hover:bg-stone-100 transition-colors cursor-pointer"
            >
              <span>{isExpanded ? 'Hide History' : 'View History'}</span>
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Last call summary snippet if exists */}
        {lastCall && !isExpanded && (
          <div className="mt-2 text-[11px] text-stone-500 bg-stone-50/70 px-2.5 py-1.5 rounded-md border border-stone-200/50 flex items-center justify-between">
            <span className="truncate max-w-[85%]">
              <span className="font-medium text-stone-700">Last note:</span> {lastCall.summary}
            </span>
            <span className="text-[10px] text-stone-400 whitespace-nowrap ml-2">
              {new Date(lastCall.timestamp).toLocaleDateString([], { month: 'numeric', day: 'numeric' })}
            </span>
          </div>
        )}

        {/* Inline Expanded Call History */}
        {isExpanded && (
          <div className="mt-4 pt-3 border-t border-stone-200 space-y-3 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-amber-700" />
                <span>Call History (Most Recent First)</span>
              </h4>
              <button
                onClick={() => onOpenDetail(lead)}
                className="text-xs text-amber-800 hover:text-amber-900 font-semibold underline cursor-pointer"
              >
                Open Full Lead Detail
              </button>
            </div>

            {lead.call_logs.length === 0 ? (
              <p className="text-xs text-stone-400 italic py-2">No calls logged yet for this lead.</p>
            ) : (
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {lead.call_logs.map((call, idx) => {
                  const callPinnedComments = pinnedComments.filter((c) => c.call_log_id === call.id);

                  return (
                    <div
                      key={call.id || idx}
                      id={`call-log-${call.id}`}
                      className="relative p-2.5 rounded-lg bg-[#FAF8F5] border border-stone-200/80 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          {getOutcomeTagBadge(call.outcome_tag)}
                          <span className="font-semibold text-stone-800">{call.summary}</span>

                          {callPinnedComments.length > 0 && (
                            <PinnedCommentBadge
                              comments={callPinnedComments}
                              currentUser={currentUser}
                              onStatusUpdated={onCommentStatusUpdated}
                              compact
                              leadName={lead.name}
                            />
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {onPinCallLog && (
                            <button
                              type="button"
                              onClick={() => onPinCallLog(lead, call.id, call.summary)}
                              className="text-[10px] font-semibold text-amber-800 hover:text-amber-950 flex items-center gap-1 hover:underline cursor-pointer"
                            >
                              <Pin className="w-2.5 h-2.5 fill-amber-700 text-amber-700" />
                              <span>Pin Directive</span>
                            </button>
                          )}
                          <span className="text-[10px] text-stone-400 font-mono">
                            {new Date(call.timestamp).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>

                      {call.full_notes && (
                        <p className="text-stone-600 text-[11px] whitespace-pre-wrap pl-1 border-l-2 border-amber-300 my-1">
                          {call.full_notes}
                        </p>
                      )}

                      {call.business_info && (
                        <div className="text-[10px] text-stone-500 bg-white p-1.5 rounded border border-stone-200 flex items-center gap-1">
                          <span className="font-bold text-stone-600 uppercase">Biz Info:</span>
                          <span>{call.business_info}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
      </div>

      {/* Smart Follow-Up Modal */}
      <SmartFollowUpModal
        isOpen={isFollowUpOpen}
        onClose={() => setIsFollowUpOpen(false)}
        lead={lead}
        outcomeTag={lastCall?.outcome_tag || 'Interested'}
        callNotes={lastCall?.full_notes || lastCall?.summary}
      />

      {/* Quick Postpone / Reschedule Modal (triggered on Right Swipe) */}
      <QuickPostponeModal
        lead={lead}
        isOpen={isPostponeModalOpen}
        onClose={() => setIsPostponeModalOpen(false)}
        onPostpone={handlePostponeSave}
      />
    </div>
  );
};
