import React, { useState, useEffect } from 'react';
import { Pin, Check, CheckCircle2, Clock, MessageSquare, AlertCircle } from 'lucide-react';
import type { PinnedComment, User } from '../types';
import { UserAvatar } from './UserAvatar';
import { api } from '../lib/api';

interface PinnedCommentBadgeProps {
  comments: PinnedComment[];
  currentUser?: User | null;
  onStatusUpdated?: (commentId: string, newStatus: 'acknowledged' | 'done') => void;
  compact?: boolean;
}

export const PinnedCommentBadge: React.FC<PinnedCommentBadgeProps> = ({
  comments,
  currentUser,
  onStatusUpdated,
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  if (!comments || comments.length === 0) return null;

  const unacknowledged = comments.filter((c) => c.status === 'unacknowledged');
  const acknowledged = comments.filter((c) => c.status === 'acknowledged');
  const done = comments.filter((c) => c.status === 'done');

  // If there are unacknowledged notes, show amber. If all acknowledged, show blue. If all done, show green.
  const primaryStatus = unacknowledged.length > 0 ? 'unacknowledged' : acknowledged.length > 0 ? 'acknowledged' : 'done';

  // Automatically acknowledge unacknowledged comments when an assigned agent opens/views the badge
  const isTargetAgent = (comment: PinnedComment) => {
    if (!currentUser) return false;
    if (currentUser.role !== 'agent') return false;
    return comment.agent_id === currentUser.id || !comment.agent_id;
  };

  const handleOpenPopover = () => {
    setIsOpen(!isOpen);
    // If agent opens the popover, auto-acknowledge any unacknowledged directives
    if (!isOpen && currentUser?.role === 'agent') {
      unacknowledged.forEach((c) => {
        if (isTargetAgent(c)) {
          api.updatePinnedCommentStatus(c.id, 'acknowledged')
            .then((res) => {
              if (onStatusUpdated) onStatusUpdated(c.id, 'acknowledged');
            })
            .catch(() => {});
        }
      });
    }
  };

  const handleMarkDone = async (commentId: string) => {
    setUpdatingId(commentId);
    try {
      await api.updatePinnedCommentStatus(commentId, 'done');
      if (onStatusUpdated) onStatusUpdated(commentId, 'done');
    } catch (err) {
      console.error('Failed to mark done', err);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="relative inline-block text-left" onClick={(e) => e.stopPropagation()}>
      {/* Visual Badge Indicator */}
      <button
        type="button"
        onClick={handleOpenPopover}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer shadow-2xs ${
          primaryStatus === 'unacknowledged'
            ? 'bg-amber-100/90 text-amber-950 border-amber-300 ring-2 ring-amber-400/20 hover:bg-amber-200'
            : primaryStatus === 'acknowledged'
            ? 'bg-sky-50 text-sky-900 border-sky-300 hover:bg-sky-100'
            : 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100'
        }`}
        title={`${comments.length} pinned manager directive(s). Click to view.`}
      >
        <Pin className={`w-3 h-3 ${primaryStatus === 'unacknowledged' ? 'text-amber-700 fill-amber-700 animate-bounce' : 'text-stone-600'}`} />
        <span>
          {comments.length} Pinned {comments.length === 1 ? 'Directive' : 'Directives'}
        </span>
        {unacknowledged.length > 0 && (
          <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
        )}
      </button>

      {/* Popover Card */}
      {isOpen && (
        <div
          className="absolute left-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-stone-200 p-3.5 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-2 border-b border-stone-100">
            <div className="flex items-center gap-1.5">
              <Pin className="w-3.5 h-3.5 text-amber-700" />
              <span className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                Manager Directives ({comments.length})
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-[11px] font-semibold text-stone-500 hover:text-stone-900 px-1.5 py-0.5 rounded hover:bg-stone-100"
            >
              Close
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1">
            {comments.map((comment) => {
              const canMarkDone =
                currentUser?.role === 'agent' ||
                currentUser?.role === 'manager' ||
                currentUser?.role === 'admin';

              return (
                <div
                  key={comment.id}
                  className={`p-3 rounded-xl border text-xs space-y-2 transition-all ${
                    comment.status === 'unacknowledged'
                      ? 'bg-amber-50/70 border-amber-300/80 shadow-2xs'
                      : comment.status === 'done'
                      ? 'bg-emerald-50/50 border-emerald-200 opacity-80'
                      : 'bg-[#FAF8F5] border-stone-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <UserAvatar
                        avatarUrl={comment.author_avatar_url}
                        name={comment.author_name}
                        size="xs"
                      />
                      <div className="min-w-0">
                        <div className="font-bold text-stone-900 truncate">{comment.author_name}</div>
                        <div className="text-[10px] text-stone-400">
                          {new Date(comment.created_at).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider ${
                        comment.status === 'done'
                          ? 'bg-emerald-100 text-emerald-800'
                          : comment.status === 'acknowledged'
                          ? 'bg-sky-100 text-sky-800'
                          : 'bg-amber-200 text-amber-950 animate-pulse'
                      }`}
                    >
                      {comment.status === 'unacknowledged'
                        ? 'Unacknowledged'
                        : comment.status === 'acknowledged'
                        ? 'Acknowledged'
                        : 'Done'}
                    </span>
                  </div>

                  {comment.call_log_snippet && (
                    <div className="text-[11px] text-stone-600 bg-white/80 p-1.5 rounded-lg border border-stone-200/80 italic">
                      Attached to call log: "{comment.call_log_snippet}"
                    </div>
                  )}

                  <p className={`text-stone-800 whitespace-pre-wrap ${comment.status === 'done' ? 'line-through text-stone-500' : ''}`}>
                    {comment.content}
                  </p>

                  {/* Actions according to spec */}
                  <div className="flex items-center justify-between pt-1 border-t border-stone-200/60 text-[11px]">
                    <div className="text-stone-400 text-[10px]">
                      {comment.status === 'acknowledged' && comment.acknowledged_at && (
                        <span>Ack'd {new Date(comment.acknowledged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      )}
                      {comment.status === 'done' && <span>Resolved</span>}
                    </div>

                    {comment.status !== 'done' && canMarkDone && (
                      <button
                        type="button"
                        onClick={() => handleMarkDone(comment.id)}
                        disabled={updatingId === comment.id}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs ${
                          currentUser?.role === 'agent'
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-stone-200 hover:bg-stone-300 text-stone-800'
                        }`}
                      >
                        <Check className="w-3 h-3" />
                        <span>
                          {updatingId === comment.id
                            ? 'Saving...'
                            : currentUser?.role === 'agent'
                            ? 'Mark as Done'
                            : 'Manager Override: Mark Done'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
