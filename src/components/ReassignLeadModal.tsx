import React, { useState, useEffect } from 'react';
import { ArrowRightLeft, X, Check, UserCheck, ShieldAlert, AlertCircle } from 'lucide-react';
import type { Lead, User } from '../types';
import { api } from '../lib/api';
import { UserAvatar } from './UserAvatar';

interface ReassignLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  currentUser: User;
  onReassigned: (updatedLead: Lead) => void;
}

export const ReassignLeadModal: React.FC<ReassignLeadModalProps> = ({
  isOpen,
  onClose,
  lead,
  currentUser,
  onReassigned,
}) => {
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setReason('');
      setSelectedOwnerId('');
      // Fetch available team members
      api.getManagerTeam()
        .then((res) => {
          let list = res.teamMembers || [];
          // Ensure current user (manager) is present in the selector
          if (!list.some((u) => u.id === currentUser.id)) {
            list = [currentUser, ...list];
          }
          setTeamMembers(list);
        })
        .catch(() => {
          setTeamMembers([currentUser]);
        });
    }
  }, [isOpen, currentUser]);

  if (!isOpen || !lead) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOwnerId) {
      setError('Please select a team member to assign this lead to.');
      return;
    }

    if (selectedOwnerId === lead.assigned_to) {
      setError('This lead is already assigned to this user.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await api.reassignLead(lead.id, selectedOwnerId);
      onReassigned(res.lead);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to reassign lead');
    } finally {
      setIsLoading(false);
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
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-900">Reassign Lead Ownership</h2>
              <p className="text-[11px] text-stone-500">Transfer lead to another agent or manager</p>
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
          <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-stone-200 space-y-1">
            <div className="text-[11px] uppercase font-bold tracking-wider text-stone-400">Target Lead</div>
            <div className="font-bold text-stone-900 text-sm">{lead.name}</div>
            <div className="text-xs text-stone-500 flex items-center gap-2">
              <span>{lead.phone}</span>
              <span>&bull;</span>
              <span>
                Current Assignee:{' '}
                <strong className="text-stone-800">{lead.assigned_to_name || 'Unassigned'}</strong>
              </span>
            </div>
          </div>

          {/* New Assignee Selector */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5">
              Select New Assignee <span className="text-amber-700">*</span>
            </label>
            <select
              value={selectedOwnerId}
              onChange={(e) => setSelectedOwnerId(e.target.value)}
              required
              className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-amber-700 cursor-pointer"
            >
              <option value="">-- Choose Agent or Manager --</option>
              {teamMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} ({member.email}) &mdash; {member.role.toUpperCase()}
                  {member.id === currentUser.id ? ' (You)' : ''}
                  {member.id === lead.assigned_to ? ' [Current Owner]' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Optional reason / note */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5">
              Reason / Handoff Note (Optional)
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Workload balancing, specialized territory, follow-up escalation..."
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
              disabled={isLoading || !selectedOwnerId}
              className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>{isLoading ? 'Reassigning...' : 'Confirm Reassignment'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
