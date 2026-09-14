import React, { useState } from 'react';
import { Pin, X, AlertCircle } from 'lucide-react';
import type { Lead, PinnedComment, User } from '../types';
import { api } from '../lib/api';

interface PinDirectiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  callLogId?: string;
  callLogSnippet?: string;
  currentUser: User;
  onCommentCreated: (comment: PinnedComment) => void;
}

export const PinDirectiveModal: React.FC<PinDirectiveModalProps> = ({
  isOpen,
  onClose,
  lead,
  callLogId,
  callLogSnippet,
  currentUser,
  onCommentCreated,
}) => {
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !lead) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await api.createPinnedComment({
        leadId: lead.id,
        callLogId: callLogId || undefined,
        agentId: lead.assigned_to || undefined,
        comment: commentText.trim(),
      });
      onCommentCreated(res.comment);
      setCommentText('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to pin directive');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative bg-white w-full max-w-md rounded-2xl shadow-xl border border-stone-200 overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="px-5 py-4 border-b border-stone-200 bg-[#FAF8F5] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-700 text-white flex items-center justify-center shadow-2xs">
              <Pin className="w-4 h-4 fill-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-900">Pin Manager Directive</h2>
              <p className="text-[11px] text-stone-500">
                {callLogId ? 'Attach note to call record' : 'Attach note to lead'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Lead Context Summary */}
          <div className="p-3 rounded-xl bg-[#FAF8F5] border border-stone-200 space-y-1">
            <div className="text-[11px] uppercase font-bold tracking-wider text-stone-400">Target</div>
            <div className="font-bold text-stone-900 text-xs">{lead.name} ({lead.phone})</div>
            {callLogSnippet && (
              <div className="text-[11px] text-stone-600 italic bg-white p-1.5 rounded border border-stone-200 mt-1">
                Call: "{callLogSnippet}"
              </div>
            )}
            <div className="text-[11px] text-stone-500">
              Assigned Agent: <strong className="text-stone-800">{lead.assigned_to_name || 'Unassigned'}</strong>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5">
              Manager Directive / Note <span className="text-amber-700">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Enter instructions, follow-up guidance, pricing approvals, or specific remarks for the agent..."
              className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-amber-700"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !commentText.trim()}
              className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Pin className="w-3.5 h-3.5 fill-white" />
              <span>{isSubmitting ? 'Pinning...' : 'Pin Directive'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
