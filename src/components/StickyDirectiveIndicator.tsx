import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Pin, Check, ArrowUp, ArrowDown, X, MessageSquare } from 'lucide-react';
import type { PinnedComment, User } from '../types';
import { UserAvatar } from './UserAvatar';
import { api } from '../lib/api';

// ============================================================================
// STACKED STICKY NOTES MODAL / POPOVER
// ============================================================================
interface StackedStickyNotesModalProps {
  comments: PinnedComment[];
  leadName?: string;
  currentUser?: User | null;
  onClose: () => void;
  onStatusUpdated?: (commentId: string, newStatus: 'acknowledged' | 'done') => void;
  positionStyle?: React.CSSProperties;
}

export const StackedStickyNotesModal: React.FC<StackedStickyNotesModalProps> = ({
  comments,
  leadName,
  currentUser,
  onClose,
  onStatusUpdated,
  positionStyle,
}) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Auto-acknowledge unacknowledged notes on open for the agent
  useEffect(() => {
    if (currentUser?.role === 'agent') {
      comments.forEach((c) => {
        if (c.status === 'unacknowledged' && (!c.agent_id || c.agent_id === currentUser.id)) {
          api
            .updatePinnedCommentStatus(c.id, 'acknowledged')
            .then(() => onStatusUpdated?.(c.id, 'acknowledged'))
            .catch(() => {});
        }
      });
    }
  }, [comments, currentUser, onStatusUpdated]);

  const activeComment = comments[activeIdx] || comments[0];

  const handleMarkDone = async (commentId: string) => {
    setUpdatingId(commentId);
    try {
      await api.updatePinnedCommentStatus(commentId, 'done');
      onStatusUpdated?.(commentId, 'done');
    } catch (err) {
      console.error('Failed to mark directive done', err);
    } finally {
      setUpdatingId(null);
    }
  };

  if (!activeComment) return null;

  const canMarkDone =
    currentUser?.role === 'agent' || currentUser?.role === 'manager' || currentUser?.role === 'admin';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-2xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={positionStyle}
        className="relative w-full max-w-md bg-[#FEF9C3] border border-amber-300/90 rounded-2xl shadow-2xl p-5 text-stone-900 animate-in zoom-in-95 duration-150 transform -rotate-0.5"
      >
        {/* Physical Sticky Tape Accent */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-20 h-6 bg-amber-200/60 border border-amber-300/60 rounded-xs shadow-2xs backdrop-blur-xs" />

        {/* Header with Manager Avatar & Stack navigation */}
        <div className="flex items-start justify-between gap-3 pt-1 border-b border-amber-200/80 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative">
              <UserAvatar
                avatarUrl={activeComment.author_avatar_url}
                name={activeComment.author_name}
                size="md"
              />
              <span className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-amber-500 text-white shadow-2xs">
                <Pin className="w-2.5 h-2.5 fill-white" />
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs text-amber-950 truncate">
                  {activeComment.author_name}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 border border-amber-300/60">
                  Manager Directive
                </span>
              </div>
              <div className="text-[11px] text-amber-800/80">
                {leadName ? `For lead: ${leadName}` : 'Pinned Note'} &bull;{' '}
                {new Date(activeComment.created_at).toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-amber-900/60 hover:text-amber-950 hover:bg-amber-200/70 transition-colors cursor-pointer"
            title="Close note"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* If multiple notes exist on this lead, display physical stacked tabs */}
        {comments.length > 1 && (
          <div className="flex items-center gap-1.5 pt-3 overflow-x-auto pb-1">
            <span className="text-[10px] font-bold text-amber-900/70 uppercase tracking-wider shrink-0 mr-1">
              Stack ({comments.length}):
            </span>
            {comments.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveIdx(i)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                  activeIdx === i
                    ? 'bg-amber-400/90 text-amber-950 shadow-xs border border-amber-500/40 -translate-y-0.5'
                    : 'bg-amber-200/70 hover:bg-amber-200 text-amber-900 border border-amber-300/50'
                }`}
              >
                <span>Note #{i + 1}</span>
                {c.status === 'unacknowledged' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-700 animate-pulse" />
                )}
                {c.status === 'done' && (
                  <Check className="w-2.5 h-2.5 text-emerald-800" />
                )}
              </button>
            ))}
          </div>
        )}

        {/* If attached to a specific call entry */}
        {activeComment.call_log_snippet && (
          <div className="mt-3 p-2 rounded-xl bg-white/70 border border-amber-300/60 text-xs text-amber-950 italic flex items-start gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
            <span className="line-clamp-2">
              Attached to Call: &quot;{activeComment.call_log_snippet}&quot;
            </span>
          </div>
        )}

        {/* Sticky Note Body */}
        <div className="mt-3.5 min-h-[70px] max-h-56 overflow-y-auto text-sm text-amber-950 leading-relaxed font-sans whitespace-pre-wrap pr-1 selection:bg-amber-300">
          {activeComment.content}
        </div>

        {/* Action Footer */}
        <div className="mt-4 pt-3 border-t border-amber-200/80 flex items-center justify-between gap-3">
          <div className="text-[11px] font-medium text-amber-900/70">
            {activeComment.status === 'done' ? (
              <span className="text-emerald-800 font-bold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Directive Resolved
              </span>
            ) : activeComment.status === 'acknowledged' ? (
              <span>Seen &amp; In Progress</span>
            ) : (
              <span className="text-amber-800 font-semibold">New Directive</span>
            )}
          </div>

          {activeComment.status !== 'done' && canMarkDone && (
            <button
              type="button"
              onClick={() => handleMarkDone(activeComment.id)}
              disabled={updatingId === activeComment.id}
              className="px-3.5 py-1.5 rounded-xl bg-amber-800 hover:bg-amber-900 active:bg-amber-950 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{updatingId === activeComment.id ? 'Marking...' : 'Mark as Done'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// PHYSICAL STICKY NOTE BADGE (ATTACHED OR DOCKED)
// ============================================================================
interface StickyNoteBadgeProps {
  comments: PinnedComment[];
  leadName?: string;
  isDocked?: 'top' | 'bottom' | null;
  stackCount?: number;
  onClick: () => void;
  compact?: boolean;
}

export const StickyNoteBadge: React.FC<StickyNoteBadgeProps> = ({
  comments,
  leadName,
  isDocked,
  stackCount = 1,
  onClick,
  compact = false,
}) => {
  const activeComments = comments.filter((c) => c.status !== 'done');
  if (activeComments.length === 0) return null;

  const first = activeComments[0];
  const hasUnack = activeComments.some((c) => c.status === 'unacknowledged');
  const count = activeComments.length;

  return (
    <div
      onClick={onClick}
      title={
        isDocked
          ? `Click to scroll to pinned directive for ${leadName || 'lead'}`
          : `${count} pinned directive(s) from ${first.author_name}. Click to open.`
      }
      className={`group relative select-none cursor-pointer transition-all duration-200 ease-out ${
        isDocked ? 'hover:scale-105 active:scale-95' : 'hover:-translate-y-0.5'
      }`}
    >
      {/* Visual Stack of Sticky Papers (if count > 1) */}
      {count > 1 && (
        <>
          <div className="absolute inset-0 bg-[#FDE68A] rounded-xl border border-amber-300 shadow-2xs translate-x-1.5 translate-y-1.5 -rotate-2 -z-10 pointer-events-none transition-transform group-hover:translate-x-2 group-hover:translate-y-2" />
          <div className="absolute inset-0 bg-[#FEF08A] rounded-xl border border-amber-300 shadow-2xs translate-x-0.5 translate-y-0.5 rotate-1 -z-5 pointer-events-none" />
        </>
      )}

      {/* Main Sticky Note Tab */}
      <div
        className={`relative flex items-center gap-2 rounded-xl border shadow-md transition-all duration-200 ${
          isDocked
            ? 'bg-[#FEF9C3] border-amber-400 text-amber-950 px-2.5 py-1.5 ring-2 ring-amber-400/30'
            : 'bg-[#FEF9C3] border-amber-300/90 text-amber-950 px-2.5 py-1.5 -rotate-0.5 group-hover:rotate-0'
        } ${compact ? 'text-[11px] py-1 px-2' : 'text-xs'}`}
      >
        {/* Subtle physical tape on top */}
        {!isDocked && (
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-6 h-2 bg-amber-300/40 border-t border-amber-400/60 rounded-xs pointer-events-none" />
        )}

        {/* Manager Profile Avatar */}
        <div className="relative shrink-0">
          <UserAvatar
            avatarUrl={first.author_avatar_url}
            name={first.author_name}
            size="xs"
          />
          {hasUnack && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-600 ring-1 ring-white animate-pulse" />
          )}
        </div>

        {/* Docked Arrow Indicator */}
        {isDocked === 'top' && (
          <ArrowUp className="w-3 h-3 text-amber-700 animate-bounce shrink-0" />
        )}
        {isDocked === 'bottom' && (
          <ArrowDown className="w-3 h-3 text-amber-700 animate-bounce shrink-0" />
        )}

        {/* Label Content */}
        <div className="flex items-center gap-1 font-bold truncate max-w-[130px] sm:max-w-[180px]">
          <Pin className="w-2.5 h-2.5 fill-amber-700 text-amber-700 shrink-0" />
          <span className="truncate">
            {isDocked
              ? leadName || first.author_name
              : count > 1
              ? `${count} Directives`
              : 'Directive'}
          </span>
        </div>

        {/* Unread count badge if multiple */}
        {count > 1 && (
          <span className="px-1.5 py-0.2 rounded-full bg-amber-300/80 border border-amber-400/60 text-[10px] font-extrabold text-amber-950 shrink-0">
            {count}
          </span>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// CONTINUOUS FLOATING & DOCKING CONTROLLER
// ============================================================================
interface FloatingDockItem {
  leadId: string;
  leadName: string;
  comments: PinnedComment[];
  dockState: 'attached' | 'docked-top' | 'docked-bottom';
  x: number;
  y: number;
  opacity: number;
}

interface StickyDirectiveFloatingLayerProps {
  pinnedComments: PinnedComment[];
  currentUser?: User | null;
  onStatusUpdated?: (commentId: string, newStatus: 'acknowledged' | 'done') => void;
  containerRef?: React.RefObject<HTMLElement | null>;
}

export const StickyDirectiveFloatingLayer: React.FC<StickyDirectiveFloatingLayerProps> = ({
  pinnedComments,
  currentUser,
  onStatusUpdated,
  containerRef,
}) => {
  const [items, setItems] = useState<FloatingDockItem[]>([]);
  const [modalComments, setModalComments] = useState<PinnedComment[] | null>(null);
  const [modalLeadName, setModalLeadName] = useState<string>('');

  const updatePositions = useCallback(() => {
    // Filter active comments (not done)
    const active = pinnedComments.filter((c) => c.status !== 'done' && c.lead_id);
    if (active.length === 0) {
      setItems([]);
      return;
    }

    // Group by lead_id
    const grouped = new Map<string, PinnedComment[]>();
    for (const c of active) {
      if (!c.lead_id) continue;
      const list = grouped.get(c.lead_id) || [];
      list.push(c);
      grouped.set(c.lead_id, list);
    }

    const container = containerRef?.current;
    const viewportTop = container ? container.getBoundingClientRect().top : 0;
    const viewportBottom = container
      ? container.getBoundingClientRect().bottom
      : window.innerHeight || document.documentElement.clientHeight;

    // Docking limits (screen coordinates)
    const topDockY = viewportTop + 72; // just beneath the top navbar
    const bottomDockY = viewportBottom - 84; // just above bottom nav/controls

    let topDockCount = 0;
    let bottomDockCount = 0;

    const newItems: FloatingDockItem[] = [];

    grouped.forEach((commentsForLead, leadId) => {
      const el = document.getElementById(`lead-card-${leadId}`);
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const leadName = commentsForLead[0]?.lead_name || 'Lead';

      // Width of floating note is roughly 160-200px
      const noteWidth = 160;
      // Position anchored to top-right of the card
      const naturalX = Math.max(16, rect.right - noteWidth - 16);
      const naturalY = rect.top - 12;

      let dockState: 'attached' | 'docked-top' | 'docked-bottom' = 'attached';
      let x = naturalX;
      let y = naturalY;

      // Check if lead is above the viewport
      if (rect.bottom < topDockY + 20) {
        dockState = 'docked-top';
        y = topDockY + topDockCount * 36;
        // Keep horizontally bounded within screen
        x = Math.min(Math.max(16, naturalX), window.innerWidth - noteWidth - 24);
        topDockCount++;
      }
      // Check if lead is below the viewport
      else if (rect.top > bottomDockY - 20) {
        dockState = 'docked-bottom';
        y = bottomDockY - bottomDockCount * 36;
        x = Math.min(Math.max(16, naturalX), window.innerWidth - noteWidth - 24);
        bottomDockCount++;
      } else {
        // Naturally attached to the card as it scrolls
        dockState = 'attached';
        y = naturalY;
        x = naturalX;
      }

      newItems.push({
        leadId,
        leadName,
        comments: commentsForLead,
        dockState,
        x,
        y,
        opacity: 1,
      });
    });

    setItems(newItems);
  }, [pinnedComments, containerRef]);

  useEffect(() => {
    let rafId: number;
    const onScrollOrResize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updatePositions);
    };

    updatePositions();
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize, { passive: true });

    const container = containerRef?.current;
    if (container) {
      container.addEventListener('scroll', onScrollOrResize, { passive: true });
    }

    const interval = setInterval(updatePositions, 1000);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
      if (container) {
        container.removeEventListener('scroll', onScrollOrResize);
      }
      clearInterval(interval);
    };
  }, [updatePositions, containerRef]);

  const handleItemClick = (item: FloatingDockItem) => {
    if (item.dockState !== 'attached') {
      // Smoothly scroll to the lead
      const el = document.getElementById(`lead-card-${item.leadId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-4', 'ring-amber-500/50', 'transition-all', 'duration-300');
        setTimeout(() => {
          el.classList.remove('ring-4', 'ring-amber-500/50');
        }, 1800);
      }
    } else {
      // Open the stacked sticky notes popup
      setModalComments(item.comments);
      setModalLeadName(item.leadName);
    }
  };

  return (
    <>
      {/* Floating and Docked Persistent Sticky Notes Layer */}
      <div className="fixed inset-0 pointer-events-none z-35 overflow-hidden">
        {items.map((item) => (
          <div
            key={item.leadId}
            style={{
              transform: `translate3d(${item.x}px, ${item.y}px, 0)`,
              transition:
                item.dockState === 'attached'
                  ? 'none' // Zero-lag tracking while scrolling over attached lead
                  : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease',
            }}
            className="absolute top-0 left-0 pointer-events-auto will-change-transform"
          >
            <StickyNoteBadge
              comments={item.comments}
              leadName={item.leadName}
              isDocked={item.dockState === 'attached' ? null : item.dockState === 'docked-top' ? 'top' : 'bottom'}
              onClick={() => handleItemClick(item)}
            />
          </div>
        ))}
      </div>

      {/* Stacked Sticky Notes Modal */}
      {modalComments && (
        <StackedStickyNotesModal
          comments={modalComments}
          leadName={modalLeadName}
          currentUser={currentUser}
          onClose={() => setModalComments(null)}
          onStatusUpdated={(id, status) => {
            onStatusUpdated?.(id, status);
            // Update local copy of modal comments
            setModalComments((prev) =>
              prev ? prev.map((c) => (c.id === id ? { ...c, status } : c)) : null
            );
          }}
        />
      )}
    </>
  );
};
