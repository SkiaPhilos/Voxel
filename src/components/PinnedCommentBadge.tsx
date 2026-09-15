import React, { useState } from 'react';
import { Pin, ArrowUp, ArrowDown } from 'lucide-react';
import type { PinnedComment, User } from '../types';
import { UserAvatar } from './UserAvatar';
import { StackedStickyNotesModal } from './StickyDirectiveIndicator';

interface PinnedCommentBadgeProps {
  comments: PinnedComment[];
  currentUser?: User | null;
  onStatusUpdated?: (commentId: string, newStatus: 'acknowledged' | 'done') => void;
  compact?: boolean;
  leadName?: string;
  isDocked?: 'top' | 'bottom' | null;
}

export const PinnedCommentBadge: React.FC<PinnedCommentBadgeProps> = ({
  comments,
  currentUser,
  onStatusUpdated,
  compact = false,
  leadName,
  isDocked = null,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!comments || comments.length === 0) return null;

  const activeComments = comments.filter((c) => c.status !== 'done');
  // If all are marked done and compact mode, we don't render to avoid clutter
  if (activeComments.length === 0 && compact) return null;

  const displayList = activeComments.length > 0 ? activeComments : comments;
  const first = displayList[0];
  const count = displayList.length;
  const hasUnack = displayList.some((c) => c.status === 'unacknowledged');

  return (
    <>
      <div
        className="relative inline-block text-left select-none"
        onClick={(e) => {
          e.stopPropagation();
          setIsModalOpen(true);
        }}
      >
        {/* Physical Sticky Note Tab */}
        <div
          title={`${count} pinned note(s) from ${first.author_name}. Click to view.`}
          className={`group relative flex items-center gap-1.5 rounded-xl border shadow-xs transition-all duration-150 cursor-pointer ${
            hasUnack
              ? 'bg-[#FEF9C3] border-amber-300 text-amber-950 ring-2 ring-amber-400/20 hover:bg-[#FEF08A]'
              : 'bg-[#FFFBEB] border-amber-200 text-amber-900 hover:bg-[#FEF9C3]'
          } ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'} ${
            isDocked ? 'hover:scale-105' : 'hover:-translate-y-0.5'
          }`}
        >
          {/* Stacked Paper Layers Effect behind main tab */}
          {count > 1 && (
            <div className="absolute inset-0 bg-[#FDE68A] rounded-xl border border-amber-300 -z-10 translate-x-1 translate-y-1 -rotate-2 pointer-events-none group-hover:translate-x-1.5" />
          )}

          {/* Faux Scotch Tape on Top */}
          {!isDocked && (
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-5 h-1.5 bg-amber-300/40 rounded-xs pointer-events-none" />
          )}

          {/* Manager Profile Picture */}
          <div className="relative shrink-0">
            <UserAvatar
              avatarUrl={first.author_avatar_url}
              name={first.author_name}
              size={compact ? 'xs' : 'xs'}
            />
            {hasUnack && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-600 ring-1 ring-white animate-pulse" />
            )}
          </div>

          {/* Docking arrow if docked */}
          {isDocked === 'top' && <ArrowUp className="w-3 h-3 text-amber-700 animate-bounce shrink-0" />}
          {isDocked === 'bottom' && <ArrowDown className="w-3 h-3 text-amber-700 animate-bounce shrink-0" />}

          {/* Note indication */}
          <div className="flex items-center gap-1 font-bold truncate max-w-[120px] sm:max-w-[160px]">
            <Pin className="w-2.5 h-2.5 fill-amber-700 text-amber-700 shrink-0" />
            <span className="truncate">
              {compact ? 'Note' : count > 1 ? `${count} Notes` : 'Directive'}
            </span>
          </div>

          {/* Count Badge for Stacked Notes */}
          {count > 1 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-300/80 border border-amber-400/60 text-[9px] font-extrabold text-amber-950">
              {count}
            </span>
          )}
        </div>
      </div>

      {/* Stacked Sticky Notes Modal Viewer */}
      {isModalOpen && (
        <StackedStickyNotesModal
          comments={displayList}
          leadName={leadName || first.lead_name}
          currentUser={currentUser}
          onClose={() => setIsModalOpen(false)}
          onStatusUpdated={onStatusUpdated}
        />
      )}
    </>
  );
};
